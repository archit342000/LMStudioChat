from backend.version import get_version, VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH

def test_version_components():
    assert VERSION_MAJOR == 4
    assert VERSION_MINOR == 0
    assert VERSION_PATCH == 1

def test_get_version_string():
    assert get_version() == "4.0.1"
