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
candidate-follow-up:
	$(PYTHON) scripts/resolve_candidate_holds.py
	$(PYTHON) scripts/pre_review_candidates.py
	$(PYTHON) scripts/validate_candidate_registry.py
review-packets:
	$(PYTHON) scripts/build_human_review_packets.py
	$(PYTHON) scripts/validate_human_reviews.py
authoring-queue:
	$(PYTHON) scripts/fetch_napps_alignment.py
	$(PYTHON) scripts/validate_napps_alignment.py
	$(PYTHON) scripts/build_primary_authoring_queue.py
	$(PYTHON) scripts/validate_primary_authoring_queue.py
	$(PYTHON) scripts/build_primary_pilot_manifest.py
	$(PYTHON) scripts/generate_primary_pilot_drafts.py
	$(PYTHON) scripts/pre_review_primary_pilot.py
	$(PYTHON) scripts/validate_primary_pilot_manifest.py
review-handoff:
	$(PYTHON) scripts/pre_review_candidates.py
	$(PYTHON) scripts/pre_review_primary_pilot.py
	$(PYTHON) scripts/prepare_human_review_handoff.py
audit:
	$(PYTHON) scripts/audit_duplicates.py
	$(PYTHON) scripts/audit_corpus.py
check:
	$(PYTHON) -m compileall -q src scripts tokenizer
	$(PYTHON) scripts/validate_human_reviews.py
	$(PYTHON) scripts/validate_candidate_registry.py
	$(PYTHON) scripts/validate_napps_alignment.py
	$(PYTHON) scripts/validate_primary_authoring_queue.py
	$(PYTHON) scripts/validate_primary_pilot_manifest.py
