from backend.version import VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH, get_version

def test_version_components():
    assert VERSION_MAJOR == 4
    assert VERSION_MINOR == 10
    assert VERSION_PATCH == 0
    
def test_get_version_string():
    assert get_version() == "4.10.0"



