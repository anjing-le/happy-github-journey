#!/usr/bin/env python3
"""Archive an accessible WeChat article without browser credentials.

Optional project tooling dependencies (not website dependencies):
    python3 -m pip install beautifulsoup4 requests Pillow
All three are required to run this helper. Python 3.10+ is supported.

    python3 capture_wechat.py --url 'https://mp.weixin.qq.com/s/…' \
        --output '.pocket/source-id/capture-20261002'
    python3 capture_wechat.py --url 'https://mp.weixin.qq.com/s/…' \
        --html '/path/to/saved-article.html' --output '/new/archive/path'

The output directory must not already exist. The helper never edits content/,
claims completeness is checked, reads a browser profile, or solves a CAPTCHA.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import html
import io
import json
import re
import sys
import time
import warnings
from datetime import datetime, timezone
from http.cookiejar import DefaultCookiePolicy
from pathlib import Path
from urllib.parse import unquote, unquote_to_bytes, urljoin, urlsplit, urlunsplit


HTML_LIMIT = 24 * 1024 * 1024  # SingleFile embeds its images in the HTML.
IMAGE_LIMIT = 20 * 1024 * 1024
TOTAL_IMAGE_LIMIT = 160 * 1024 * 1024
IMAGE_DOMAINS = ("qpic.cn", "qlogo.cn")
FORMATS = {
    "JPEG": "jpg", "PNG": "png", "GIF": "gif", "WEBP": "webp",
    "BMP": "bmp", "TIFF": "tiff", "ICO": "ico", "AVIF": "avif",
}
BLOCK_TAGS = {
    "p", "div", "section", "article", "blockquote", "li", "ul", "ol",
    "h1", "h2", "h3", "h4", "h5", "h6", "pre", "table", "tr",
    "figure", "figcaption", "hr",
}


class CaptureError(Exception):
    pass


class NoCookies(DefaultCookiePolicy):
    def set_ok(self, cookie, request):
        return False


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_url(value: str) -> str:
    """Avoid retaining access/challenge tokens from redirect query strings."""
    parts = urlsplit(value)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def valid_network_url(value: str, image: bool = False) -> None:
    parts = urlsplit(value)
    host = (parts.hostname or "").lower()
    try:
        port = parts.port
    except ValueError as exc:
        raise CaptureError("invalid URL port") from exc
    if parts.scheme != "https" or parts.username or parts.password or port not in (None, 443):
        raise CaptureError("only HTTPS URLs without credentials and with the default port are accepted")
    allowed = any(host == domain or host.endswith("." + domain) for domain in IMAGE_DOMAINS) if image else host == "mp.weixin.qq.com"
    if not allowed:
        raise CaptureError("image host is not a trusted WeChat CDN" if image else "source host must be mp.weixin.qq.com")


def fetch(url: str, session, limit: int, image: bool = False) -> tuple[bytes, str, dict]:
    """Bounded ordinary requests, with manual redirects and no cookie storage."""
    current = url
    started = time.monotonic()
    for _ in range(6):
        valid_network_url(current, image=image)
        session.cookies.clear()
        with session.get(current, stream=True, timeout=(10, 20), allow_redirects=False) as response:
            if response.status_code in (301, 302, 303, 307, 308):
                location = response.headers.get("Location")
                if not location:
                    raise CaptureError("redirect response has no Location")
                current = urljoin(current, location)
                continue
            if response.status_code != 200:
                raise CaptureError(f"HTTP {response.status_code} at {safe_url(current)}")
            length = response.headers.get("Content-Length", "")
            if length.isdigit() and int(length) > limit:
                raise CaptureError(f"response exceeds {limit} bytes")
            chunks, size = [], 0
            for chunk in response.iter_content(chunk_size=65536):
                size += len(chunk)
                if size > limit or time.monotonic() - started > 60:
                    raise CaptureError("response exceeded its byte or time limit")
                chunks.append(chunk)
            return b"".join(chunks), current, {
                "status": response.status_code,
                "content_type": response.headers.get("Content-Type", ""),
            }
    raise CaptureError("too many redirects")


def read_limited(path: Path, limit: int) -> bytes:
    if not path.is_file():
        raise CaptureError("input file does not exist or is not a regular file")
    with path.open("rb") as handle:
        data = handle.read(limit + 1)
    if len(data) > limit:
        raise CaptureError(f"input file exceeds {limit} bytes")
    return data


def local_image(ref: str, input_html: Path) -> bytes:
    """Read only a neighbouring file or a sibling *_files resource directory."""
    parts = urlsplit(ref)
    if parts.scheme or parts.netloc:
        raise CaptureError("absolute file URLs and nonlocal resource URLs are not accepted")
    relative = Path(unquote(parts.path))
    if relative.is_absolute() or re.match(r"^[A-Za-z]:", str(relative)):
        raise CaptureError("absolute local image paths are not accepted")
    if ".." in relative.parts:
        raise CaptureError("local image path escapes the HTML resource directory")
    root = input_html.parent.resolve()
    candidate = (root / relative).resolve()
    if not candidate.is_relative_to(root):
        raise CaptureError("local image symlink escapes the HTML resource directory")
    relative_parts = candidate.relative_to(root).parts
    if len(relative_parts) > 1 and not relative_parts[0].endswith("_files"):
        raise CaptureError("local images must be beside the HTML or within a sibling *_files directory")
    return read_limited(candidate, IMAGE_LIMIT)


def image_bytes(ref: str, input_html: Path | None, source_url: str, session) -> tuple[bytes, str]:
    if ref.startswith("data:"):
        if len(ref) > IMAGE_LIMIT * 4 // 3 + 4096:
            raise CaptureError("embedded image exceeds the byte limit")
        header, separator, data = ref.partition(",")
        if not separator or not header.lower().startswith("data:image/"):
            raise CaptureError("embedded resource is not an image data URI")
        try:
            raw = base64.b64decode(re.sub(r"\s+", "", data), validate=True) if ";base64" in header.lower() else unquote_to_bytes(data)
        except (ValueError, TypeError) as exc:
            raise CaptureError("invalid embedded image encoding") from exc
        if len(raw) > IMAGE_LIMIT:
            raise CaptureError("embedded image exceeds the byte limit")
        return raw, "embedded"
    if ref.startswith("//"):
        ref = "https:" + ref
    parts = urlsplit(ref)
    if parts.scheme or parts.netloc:
        valid_network_url(ref, image=True)
        raw, final, _ = fetch(ref, session, IMAGE_LIMIT, image=True)
        return raw, safe_url(final)
    if input_html is not None:
        return local_image(ref, input_html), "local"
    return image_bytes(urljoin(source_url, ref), None, source_url, session)


def inspect_image(raw: bytes, image_module) -> dict:
    if not raw:
        raise CaptureError("image is empty")
    with warnings.catch_warnings():
        warnings.simplefilter("error", image_module.DecompressionBombWarning)
        with image_module.open(io.BytesIO(raw)) as image:
            fmt = image.format
            if fmt not in FORMATS:
                raise CaptureError(f"unsupported or unsafe image format: {fmt}")
            width, height = image.size
            if width <= 0 or height <= 0 or width * height > 50_000_000:
                raise CaptureError("image dimensions exceed the permitted limit")
            animated = bool(getattr(image, "is_animated", False))
            image.verify()
        with image_module.open(io.BytesIO(raw)) as image:
            image.load()  # Catch truncated raster data that header verification can miss.
    return {"format": fmt, "width": width, "height": height, "animated": animated,
            "bytes": len(raw), "sha256": sha256(raw)}


def reference_for_image(tag, imported: bool) -> str:
    src = str(tag.get("src", "")).strip()
    lazy = str(tag.get("data-src", "")).strip()
    # SingleFile/browser-save src points to the preserved image; data-src may
    # still point to a network resource or a lazy-loading original.
    if imported and src and (src.startswith("data:") or not urlsplit(src).scheme and not src.startswith("//")):
        return src
    return lazy or src


def ordered_blocks(body, image_records: dict, tag_class, string_class, comment_class) -> list[dict]:
    """Keep body text and image positions; never copy active HTML into reading HTML."""
    blocks, text_chunks = [], []

    def flush():
        text = "".join(text_chunks).strip()
        if text:
            blocks.append({"kind": "text", "text": text})
        text_chunks.clear()

    def walk(node):
        if isinstance(node, comment_class):
            return
        if isinstance(node, string_class):
            text_chunks.append(str(node))
            return
        if not isinstance(node, tag_class) or node.name in ("script", "style", "template"):
            return
        if node.name == "img":
            flush()
            blocks.append({"kind": "image", "record": image_records[id(node)]})
            return
        if node.name == "br":
            text_chunks.append("\n")
            return
        if node.name == "pre" and not node.find("img"):
            flush()
            blocks.append({"kind": "code", "text": node.get_text("", strip=False)})
            return
        if node.name in BLOCK_TAGS:
            flush()
        for child in node.children:
            walk(child)
        if node.name in BLOCK_TAGS:
            flush()
        elif node.name in ("td", "th"):
            text_chunks.append("\t")

    walk(body)
    flush()
    return blocks


def render(title: str, source_url: str, blocks: list[dict], missing: list[dict]) -> tuple[str, str]:
    markdown = ["# " + title, "", "来源：" + source_url, ""]
    reading = []
    for block in blocks:
        if block["kind"] == "code":
            text = block["text"]
            fence = "`" * max(3, max((len(run) + 1 for run in re.findall(r"`+", text)), default=3))
            markdown.extend([fence, text.rstrip("\n"), fence, ""])
            reading.append("<pre><code>" + html.escape(text) + "</code></pre>")
        elif block["kind"] == "text":
            text = block["text"]
            markdown.extend([text, ""])
            reading.append("<p>" + html.escape(text) + "</p>")
        else:
            record = block["record"]
            if record["status"] == "saved":
                alt = record["alt"] or f"原文图片 {record['index']}"
                # Markdown alt escaping prevents an imported alt from changing
                # the generated image URL or adding HTML.
                safe_alt = alt.replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]").replace("\n", " ")
                markdown.extend([f"![{safe_alt}]({record['file']})", ""])
                reading.append(f'<figure><img src="{record["file"]}" alt="{html.escape(alt, quote=True)}"></figure>')
            else:
                message = f"[原文图片 {record['index']} 未保存：{record['error']}]"
                markdown.extend([message, ""])
                reading.append("<p class=missing>" + html.escape(message) + "</p>")
    if missing:
        markdown.extend(["## 存档缺失与限制", ""])
        markdown.extend("- " + item["detail"] for item in missing)
        reading.append("<aside><h2>存档缺失与限制</h2><ul>" + "".join("<li>" + html.escape(item["detail"]) + "</li>" for item in missing) + "</ul></aside>")
    source = html.escape(source_url, quote=True)
    reading_html = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>{html.escape(title)}</title><style>
body{{max-width:760px;margin:32px auto;padding:0 20px;font:18px/1.8 system-ui,sans-serif;color:#222;background:#fff;overflow-wrap:anywhere}}
h1{{font-size:1.7em;line-height:1.4}}p,pre{{white-space:pre-wrap}}figure{{margin:24px 0}}img{{display:block;max-width:100%;height:auto}}
.missing,aside{{color:#733;padding:12px;background:#fff4f0}}a{{color:#175db6}}
</style></head><body><h1>{html.escape(title)}</h1><p><a href="{source}" rel="noreferrer noopener">原始链接</a></p>
{''.join(reading)}</body></html>'''
    return "\n".join(markdown) + "\n", reading_html


def capture(args, dependencies) -> tuple[dict, int]:
    soup_class, tag_class, string_class, comment_class, requests, image_module = dependencies
    output = Path(args.output).expanduser()
    if output.exists() or output.is_symlink():
        raise CaptureError("output already exists; select a new capture directory to preserve existing archives")
    output.mkdir(parents=True, exist_ok=False)
    attempt = {
        "schema_version": 1, "captured_at": datetime.now(timezone.utc).isoformat(),
        "source_url": args.url, "method": "html_import" if args.html else "ordinary_http",
        "status": "failed", "completeness": "unknown",
    }
    raw = None
    session = requests.Session()
    session.trust_env = False  # No environment proxy, .netrc credentials, or profile data.
    session.cookies.set_policy(NoCookies())
    try:
        valid_network_url(args.url)
        parts = urlsplit(args.url)
        if not (parts.path.startswith("/s/") or parts.path == "/s"):
            raise CaptureError("source URL must be a WeChat article share URL")
        input_html = Path(args.html).expanduser().resolve() if args.html else None
        if input_html:
            raw = read_limited(input_html, HTML_LIMIT)
            final_url = args.url
        else:
            raw, final_url, response_info = fetch(args.url, session, HTML_LIMIT)
            attempt["response"] = {**response_info, "final_url": safe_url(final_url)}
        attempt["response_bytes"] = len(raw)
        attempt["response_sha256"] = sha256(raw)
        soup = soup_class(raw, "html.parser")
        body = soup.find(id="js_content")
        signals = [term for term in ("环境异常", "去验证", "该内容已被发布者删除", "此内容因违规无法查看", "内容已删除") if term in soup.get_text(" ", strip=True)]
        if body is None:
            attempt["verification_or_removal_signals"] = signals
            raise CaptureError("no #js_content article body; this is a verification/removal/non-article page")
        if "/wappoc_appmsgcaptcha" in urlsplit(final_url).path:
            raise CaptureError("server redirected to a CAPTCHA page")
        title_tag = soup.find(id="activity-name")
        title = title_tag.get_text(" ", strip=True) if title_tag else ""
        if not title:
            og_title = soup.find("meta", attrs={"property": "og:title"})
            title = str(og_title.get("content", "")).strip() if og_title else ""
        if not title and soup.title:
            title = soup.title.get_text(" ", strip=True)
        if not title or title in ("微信公众平台", "环境异常", "验证", "文章已删除"):
            raise CaptureError("article title is missing or is a verification/removal title")
        visible_body = body.get_text(" ", strip=True)
        if len(visible_body) < 200 and any(visible_body.startswith(term) for term in ("该内容已被发布者删除", "此内容因违规无法查看", "内容已删除")):
            raise CaptureError("article body is a removal notice")
        background_styles = [str(tag.get("style", "")) for tag in body.find_all(style=True)]
        background_styles.extend(tag.get_text() for tag in body.find_all("style"))
        for active in body.find_all(("script", "style", "template")):
            active.decompose()
        image_tags = body.find_all("img")
        if not body.get_text(strip=True) and not image_tags:
            raise CaptureError("article body has neither text nor images")
        missing = []
        for media in body.find_all(("video", "audio", "iframe", "embed", "object", "mp-video", "mpvoice", "mp-common-mpaudio", "mp-common-videosnap", "svg", "canvas")):
            missing.append({"kind": "media", "tag": media.name, "detail": f"原文含 {media.name} 媒体或动态图层；此存档没有保存其播放内容。"})
        backgrounds = []
        for style in background_styles:
            backgrounds.extend(re.findall(r"url\(\s*['\"]?(.*?)['\"]?\s*\)", style, re.I))
        for index, _ in enumerate(backgrounds, 1):
            missing.append({"kind": "background_image", "detail": f"原文背景图 {index} 未转换为正文图片，请对照原页面检查。"})
        full_text = soup.get_text(" ", strip=True)
        pay_markers = [term for term in ("付费阅读", "付费后可阅读", "付费后阅读", "购买后阅读", "剩余内容需付费", "订阅后阅读全文") if term in full_text]
        if pay_markers:
            missing.append({"kind": "paywall", "detail": "页面出现付费/订阅提示（" + "、".join(pay_markers) + "），未确认取得受限正文。"})
        if body.select(".video_iframe, .js_video_channel_container, .js_unfinished_cover") and not any(item["kind"] == "media" for item in missing):
            missing.append({"kind": "media", "detail": "原文存在视频或未完成加载的容器，没有保存其播放内容。"})
        image_records, images_by_tag, total_bytes = [], {}, 0
        for index, tag in enumerate(image_tags, 1):
            ref = reference_for_image(tag, imported=bool(input_html))
            record = {"index": index, "alt": str(tag.get("alt", "")), "status": "failed"}
            record["reference_type"] = "embedded" if ref.startswith("data:") else "remote" if ref.startswith(("https://", "http://", "//")) else "local" if input_html else "relative"
            if record["reference_type"] == "remote":
                record["source"] = safe_url("https:" + ref if ref.startswith("//") else ref)
            try:
                if not ref:
                    raise CaptureError("image has no src or data-src")
                raw_image, origin = image_bytes(ref, input_html, args.url, session)
                metadata = inspect_image(raw_image, image_module)
                lazy = str(tag.get("data-src", "")).strip()
                if metadata["width"] == 1 and metadata["height"] == 1 and lazy and lazy != ref and (tag.get("data-ratio") or tag.get("data-w")):
                    # Browser/SingleFile exports can preserve a lazy-loading
                    # pixel instead of the article image. Never archive that
                    # pixel as a successfully captured figure.
                    raw_image, origin = image_bytes(lazy, input_html, args.url, session)
                    metadata = inspect_image(raw_image, image_module)
                    if metadata["width"] == 1 and metadata["height"] == 1:
                        raise CaptureError("suspected lazy-loading placeholder; real article image was not obtained")
                    record["lazy_placeholder_replaced"] = True
                if total_bytes + len(raw_image) > TOTAL_IMAGE_LIMIT:
                    raise CaptureError("total saved image bytes would exceed the capture limit")
                file = f"images/{index:03d}-{metadata['sha256'][:12]}.{FORMATS[metadata['format']]}"
                (output / "images").mkdir(exist_ok=True)
                (output / file).write_bytes(raw_image)
                total_bytes += len(raw_image)
                record.update(metadata, file=file, status="saved", origin=origin)
            except Exception as exc:
                record["error"] = str(exc)[:300]
                missing.append({"kind": "image", "index": index, "detail": f"原文图片 {index} 未保存：{record['error']}"})
            image_records.append(record)
            images_by_tag[id(tag)] = record
        blocks = ordered_blocks(body, images_by_tag, tag_class, string_class, comment_class)
        text_characters = sum(len(block["text"]) for block in blocks if block["kind"] in ("text", "code"))
        saved = sum(record["status"] == "saved" for record in image_records)
        if text_characters == 0 and saved == 0:
            raise CaptureError("no readable article text or successfully saved image remains")
        (output / "original.html").write_bytes(raw)
        markdown, reading_html = render(title, args.url, blocks, missing)
        (output / "article.md").write_text(markdown, encoding="utf-8")
        (output / "reading.html").write_text(reading_html, encoding="utf-8")
        author_tag = soup.find(id="js_name") or soup.find(id="js_author_name")
        metadata = {
            **attempt, "status": "saved", "title": title,
            "author_or_account": author_tag.get_text(" ", strip=True) if author_tag else None,
            "original": {
                "file": "original.html", "bytes": len(raw), "sha256": sha256(raw),
                "referenced_resources_preserved_at_original_paths": False,
                "dependency_note": "只原样保留输入 HTML；未按原路径复制 *_files、样式或远程引用资源。成功保存的正文图片在 images/，离线阅读请使用 reading.html。原始 HTML 含源站脚本，请勿把它当作安全离线阅读文件。",
            },
            "reading_file": "reading.html", "markdown_file": "article.md",
            "text_characters": text_characters,
            "images": {"total": len(image_records), "saved": saved, "failed": len(image_records) - saved, "records": image_records},
            "missing": missing, "completeness": "partial" if missing else "unknown",
            "completeness_note": "自动检测未确认完整性；需对照原页面检查正文、图片、动图、视频和加载状态。",
        }
        write_json(output / "capture.json", metadata)
        return metadata, 0
    except Exception as exc:
        attempt["error"] = str(exc)[:1000]
        if raw is not None:
            (output / "attempt-response.html").write_bytes(raw)
            attempt["response_file"] = "attempt-response.html"
        write_json(output / "attempt.json", attempt)
        return attempt, 2
    finally:
        session.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", required=True, help="original https://mp.weixin.qq.com/s/… share URL")
    parser.add_argument("--output", required=True, help="new private archive directory; must not exist")
    parser.add_argument("--html", help="import an HTML/SingleFile export instead of fetching the article")
    args = parser.parse_args()
    try:
        from bs4 import BeautifulSoup, Tag, NavigableString, Comment
        import requests
        from PIL import Image
    except ImportError as exc:
        print("Missing optional capture dependency. Install: python3 -m pip install beautifulsoup4 requests Pillow\n" + str(exc), file=sys.stderr)
        return 2
    try:
        result, code = capture(args, (BeautifulSoup, Tag, NavigableString, Comment, requests, Image))
    except (CaptureError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        return 2
    print(json.dumps({key: result[key] for key in ("status", "completeness", "title", "error", "images") if key in result}, ensure_ascii=False))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
