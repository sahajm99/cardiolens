import pytest
from pipeline.load import load_data


@pytest.fixture(scope="session")
def df():
    return load_data()
