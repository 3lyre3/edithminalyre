# Record

````
name: Run Python Script

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]
  workflow_dispatch: # Allows manual triggering from the Actions tab

jobs:
  run-script:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11' # Specify your preferred Python version

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          if [ -f requirements.txt ]; then pip install -r requirements.txt; fi

      - name: Execute Python script
        run: python3 danaeam-codex/build_lookups.py # Replace with your script's filename 
````
