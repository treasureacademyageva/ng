import json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def report():return json.loads((ROOT/'results/tiny-gpu-benchmark-t4-20260930.json').read_text())
def test_gpu_benchmark_is_exact_and_not_authorisation():
 r=report();b=r['benchmark'];assert r['kind']=='GPU' and b['steps']==100;assert r['parameters']==13_980_672;assert r['long_run_authorised'] is False;assert b['tokens_per_step']==b['batch_size']*b['block_size']*b['gradient_accumulation']
def test_gpu_benchmark_arithmetic_and_losses():
 r=report();b=r['benchmark'];p=r['projection'];assert abs(b['tokens_per_second']-b['tokens_per_step']/b['seconds_per_step'])<1e-6;assert abs(p['estimated_hours']-p['target_steps']*b['seconds_per_step']/3600)<1e-9;assert all(math.isfinite(b[k]) for k in ('initial_training_loss','final_training_loss','initial_validation_loss','final_validation_loss'));assert b['final_validation_loss']<b['initial_validation_loss']
def test_gpu_sample_is_retained_for_review():
 r=report();assert len(r['sample'])>100 and 'Earth' in r['sample']
