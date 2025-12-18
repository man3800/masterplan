cd $PSScriptRoot
$venv = ".venv"

if (-not (Test-Path $venv)) {
    py -3.13 -m venv $venv
}

& "$venv\Scripts\activate.ps1"
pip install -r requirements.txt
$env:PYTHONPATH = "$PSScriptRoot"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000