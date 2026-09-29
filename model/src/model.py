from __future__ import annotations
from dataclasses import dataclass
import math
import torch
import torch.nn as nn
from torch.nn import functional as F

@dataclass
class GPTConfig:
    vocab_size:int
    block_size:int=128
    n_layer:int=2
    n_head:int=4
    n_embd:int=128
    dropout:float=0.1

class CausalSelfAttention(nn.Module):
    def __init__(self,c:GPTConfig):
        super().__init__();assert c.n_embd%c.n_head==0
        self.n_head=c.n_head;self.n_embd=c.n_embd;self.dropout=c.dropout
        self.qkv=nn.Linear(c.n_embd,3*c.n_embd,bias=False);self.proj=nn.Linear(c.n_embd,c.n_embd,bias=False)
        self.resid_dropout=nn.Dropout(c.dropout)
    def forward(self,x):
        b,t,c=x.shape;q,k,v=self.qkv(x).split(self.n_embd,dim=2);hs=c//self.n_head
        q=q.view(b,t,self.n_head,hs).transpose(1,2);k=k.view(b,t,self.n_head,hs).transpose(1,2);v=v.view(b,t,self.n_head,hs).transpose(1,2)
        y=F.scaled_dot_product_attention(q,k,v,dropout_p=self.dropout if self.training else 0.0,is_causal=True)
        y=y.transpose(1,2).contiguous().view(b,t,c)
        return self.resid_dropout(self.proj(y))

class MLP(nn.Module):
    def __init__(self,c):
        super().__init__();self.net=nn.Sequential(nn.Linear(c.n_embd,4*c.n_embd),nn.GELU(),nn.Linear(4*c.n_embd,c.n_embd),nn.Dropout(c.dropout))
    def forward(self,x):return self.net(x)
class Block(nn.Module):
    def __init__(self,c):
        super().__init__();self.ln1=nn.LayerNorm(c.n_embd);self.attn=CausalSelfAttention(c);self.ln2=nn.LayerNorm(c.n_embd);self.mlp=MLP(c)
    def forward(self,x):return x+self.attn(self.ln1(x))+self.mlp(self.ln2(x))

class GPT(nn.Module):
    def __init__(self,c:GPTConfig):
        super().__init__();self.config=c
        self.tok=nn.Embedding(c.vocab_size,c.n_embd);self.pos=nn.Embedding(c.block_size,c.n_embd);self.drop=nn.Dropout(c.dropout)
        self.blocks=nn.ModuleList([Block(c) for _ in range(c.n_layer)]);self.ln=nn.LayerNorm(c.n_embd);self.head=nn.Linear(c.n_embd,c.vocab_size,bias=False)
        self.head.weight=self.tok.weight;self.apply(self._init)
        for n,p in self.named_parameters():
            if n.endswith('proj.weight'):nn.init.normal_(p,mean=0.0,std=0.02/math.sqrt(2*c.n_layer))
    def _init(self,m):
        if isinstance(m,(nn.Linear,nn.Embedding)):nn.init.normal_(m.weight,mean=0.0,std=0.02)
        if isinstance(m,nn.Linear) and m.bias is not None:nn.init.zeros_(m.bias)
    def forward(self,idx,targets=None):
        b,t=idx.shape
        if t>self.config.block_size:raise ValueError(f'sequence {t} > block size {self.config.block_size}')
        x=self.drop(self.tok(idx)+self.pos(torch.arange(t,device=idx.device)))
        for block in self.blocks:x=block(x)
        logits=self.head(self.ln(x));loss=None
        if targets is not None:loss=F.cross_entropy(logits.reshape(-1,logits.size(-1)),targets.reshape(-1))
        return logits,loss
    @torch.no_grad()
    def generate(self,idx,max_new_tokens,temperature=0.8,top_k=40):
        self.eval()
        for _ in range(max_new_tokens):
            crop=idx[:,-self.config.block_size:];logits,_=self(crop);logits=logits[:,-1,:]/max(temperature,1e-5)
            if top_k:
                v,_=torch.topk(logits,min(top_k,logits.size(-1)));logits[logits<v[:,-1,None]]=-float('Inf')
            idx=torch.cat((idx,torch.multinomial(F.softmax(logits,dim=-1),1)),dim=1)
        return idx
    def parameter_count(self):return sum(p.numel() for p in self.parameters())
