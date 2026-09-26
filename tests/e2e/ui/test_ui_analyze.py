import re
import struct

from playwright.sync_api import expect

FILE_INPUT = "input[type=file]"


def big_bmp(w=2400, h=1800) -> bytes:
    """An uncompressed 24-bit BMP, ~13 MB: a stand-in for a full-size phone photo."""
    row = (w * 3 + 3) & ~3
    header = b"BM" + struct.pack("<IHHI", 54 + row * h, 0, 0, 54) + struct.pack(
        "<IiiHHIIiiII", 40, w, h, 1, 24, 0, row * h, 2835, 2835, 0, 0)
    return header + bytes(range(256)) * (row * h // 256) + bytes(row * h % 256)


def test_analyze_golden_retriever(page, registered):
    """The real pipeline (classification + RAG + LLM) through the browser."""
    page.set_input_files(FILE_INPUT, "/test_data/golden_retriever_1.jpg")
    expect(page.get_by_role("status")).to_be_visible()  # the waiting state
    expect(page.get_by_role("heading", name=re.compile("retriever", re.I))).to_be_visible(timeout=300_000)
    expect(page.get_by_role("progressbar", name="Confidence")).to_be_visible()
    expect(page.get_by_role("button", name="Save as my pet")).to_be_visible()


def test_result_card_and_analyze_another(page, registered, fake_vision):
    page.set_input_files(FILE_INPUT, "/test_data/golden_retriever_1.jpg")
    expect(page.get_by_role("heading", name="Golden Retriever")).to_be_visible()
    expect(page.get_by_text("A friendly golden dog sitting on the grass.")).to_be_visible()
    expect(page.get_by_text("Large")).to_be_visible()
    expect(page.get_by_text("Bright, clear eyes")).to_be_visible()
    assert fake_vision[0]["language"] == "en"
    assert fake_vision[0]["image"].startswith("data:image/jpeg;base64,")
    page.get_by_role("button", name="Analyze another photo").click()
    expect(page.get_by_text("Drag or take a photo")).to_be_visible()


def test_big_photo_is_resized_before_upload(page, registered, fake_vision):
    page.set_input_files(FILE_INPUT, files=[{"name": "big.bmp", "mimeType": "image/bmp", "buffer": big_bmp()}])
    expect(page.get_by_role("heading", name="Golden Retriever")).to_be_visible()
    size = page.evaluate("""(uri) => new Promise(r => { const i = new Image();
        i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = uri })""", fake_vision[0]["image"])
    assert size == [1600, 1200]
    assert len(fake_vision[0]["image"]) < 8_000_000


def test_non_image_file_is_friendly(page, registered, fake_vision):
    page.set_input_files(FILE_INPUT, files=[{"name": "notes.jpg", "mimeType": "image/jpeg", "buffer": b"not a photo"}])
    expect(page.get_by_text("That file doesn't look like a photo. Try a JPEG or PNG.")).to_be_visible()
    expect(page.get_by_text("Drag or take a photo")).to_be_visible()  # can try again
    assert fake_vision == []  # nothing was sent


def test_vision_error_is_friendly(page, registered):
    # The vision route nests its envelope under "detail" (FastAPI HTTPException).
    page.route("**/api/v1/vision/analyze", lambda r: r.fulfill(status=422, json={
        "detail": {"success": False, "data": None, "error": {"code": "UNSUPPORTED_SPECIES", "message": "x"}}}))
    page.set_input_files(FILE_INPUT, "/test_data/golden_retriever_1.jpg")
    expect(page.get_by_text("For now I only recognise dogs and cats 🐾")).to_be_visible()


def test_nginx_html_error_is_friendly(page, registered):
    page.route("**/api/v1/vision/analyze", lambda r: r.fulfill(
        status=413, content_type="text/html", body="<html><body>413 Request Entity Too Large</body></html>"))
    page.set_input_files(FILE_INPUT, "/test_data/golden_retriever_1.jpg")
    expect(page.get_by_text("This photo is too large. Try a smaller one.")).to_be_visible()
