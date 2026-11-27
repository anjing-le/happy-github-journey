import unittest

from bs4 import BeautifulSoup
from capture_wechat import body_has_source


class ProvenanceTest(unittest.TestCase):
    source = "https://mp.weixin.qq.com/s/article-token"

    def check_body(self, body, expected):
        self.assertEqual(body_has_source(BeautifulSoup(body, "html.parser"), self.source), expected)

    def test_original_and_verified_share_parameter(self):
        for suffix in ("", "/", "?nwr_flag=1"):
            with self.subTest(suffix=suffix):
                self.check_body("原文链接：" + self.source + suffix + "。", True)
                self.check_body('<a href="' + self.source + suffix + '">原文</a>', True)

    def test_different_articles_and_arbitrary_queries_are_not_provenance(self):
        for candidate in (
            self.source + "-another",
            self.source + "/another",
            self.source + "?nwr_flag=2",
            self.source + "?nwr_flag=1&next=another",
            self.source + "?next=another",
            "https://other.example/?url=" + self.source,
        ):
            with self.subTest(candidate=candidate):
                self.check_body('<a href="' + candidate + '">原文</a>', False)
                self.check_body("原文：" + candidate, False)


if __name__ == "__main__":
    unittest.main()
