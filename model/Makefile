PYTHON ?= python3
fetch:
	$(PYTHON) scripts/fetch_open_data.py --manifest data/sources.json
curriculum:
	$(PYTHON) scripts/build_curriculum.py
prepare: curriculum
	$(PYTHON) scripts/prepare_data.py --config config/micro.json
train:
	$(PYTHON) src/train.py --config config/micro.json
smoke:
	$(PYTHON) src/train.py --config config/micro.json --max-steps 10
instruction:
	$(PYTHON) scripts/build_instruction_data.py
check:
	$(PYTHON) -m compileall -q src scripts tokenizer
