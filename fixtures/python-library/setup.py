from setuptools import setup, find_packages

setup(
    name="pylib",
    version="0.1.0",
    description="Fixture: a small Python package with a public surface and pytest/unittest tests.",
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    entry_points={
        "console_scripts": [
            "pylib-add = pylib.cli:main",
        ],
    },
)
