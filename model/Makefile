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
stage-stories:
	$(PYTHON) scripts/stage_storybooks_nigeria.py
review-packets:
	$(PYTHON) scripts/build_human_review_packets.py
	$(PYTHON) scripts/validate_human_reviews.py
authoring-queue:
	$(PYTHON) scripts/build_primary_authoring_queue.py
	$(PYTHON) scripts/validate_primary_authoring_queue.py
audit:
	$(PYTHON) scripts/audit_duplicates.py
	$(PYTHON) scripts/audit_corpus.py
check:
	$(PYTHON) -m compileall -q src scripts tokenizer
	$(PYTHON) scripts/validate_human_reviews.py
	$(PYTHON) scripts/validate_primary_authoring_queue.py
