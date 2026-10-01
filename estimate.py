import heapq, math
# ---- inventory (Unicode order) ----
V  = list("അആഇഈഉഊഋഎഏഐഒഓഔ")                       # independent vowels 13
C  = list("കഖഗഘങചഛജഝഞടഠഡഢണതഥദധനപഫബഭമയരലവശഷസഹളഴറ")  # consonants 36
S  = list("ാിീുൂൃെേൈൊോൗ")                          # vowel signs 12
X  = list("്ംഃ")                                    # virama, anusvara, visarga
CH = list("ൺൻർൽൾ")                                  # chillu 5
P  = ['␣', '.', ',', '?']                            # space + punct
inv = V + C + S + X + CH + P
cls = {**{u:'V' for u in V}, **{u:'C' for u in C}, **{u:'S' for u in S},
       '്':'VIR','ം':'ANU','ഃ':'ANU', **{u:'CH' for u in CH}, '␣':'SP','.':'SP',',':'SP','?':'SP'}
# ---- rough unigram frequency ranking (hand-estimated from Malayalam corpus knowledge) ----
rank = "␣ ് ാ ി ക ന ു ത ര ം ല യ മ വ െ സ ട ള പ ണ ീ േ ച ദ ങ ോ ൻ ർ അ ഇ എ ഞ ഭ ശ ഹ ഗ ൽ ഷ ഴ റ ഉ ഡ ബ ധ ജ ൂ ആ ഥ ഖ ഓ ൾ . ൺ ഘ ഛ ഝ ഠ ഢ ഫ ൈ ൊ ൃ ഏ ഐ ഒ ഔ ഈ ഊ ഋ ൗ ഃ , ?".split()
assert set(rank)==set(inv), set(inv)^set(rank)
uni = {u: 1.0/(i+2)**1.05 for i,u in enumerate(rank)}      # zipf-ish
Z=sum(uni.values()); uni={u:p/Z for u,p in uni.items()}
# ---- class-transition model (hand-estimated orthographic structure) ----
T = {'SP': {'C':.72,'V':.26,'CH':.0,'S':.0,'VIR':.0,'ANU':.0,'SP':.02},
     'C':  {'S':.45,'C':.22,'VIR':.16,'SP':.08,'ANU':.05,'CH':.03,'V':.01},
     'S':  {'C':.55,'SP':.33,'ANU':.05,'CH':.05,'VIR':.01,'V':.01,'S':.0},
     'VIR':{'C':.96,'SP':.03,'V':.01,'S':.0,'ANU':.0,'CH':.0,'VIR':.0},
     'V':  {'C':.90,'SP':.08,'CH':.02,'S':.0,'V':.0,'VIR':.0,'ANU':.0},
     'ANU':{'SP':.72,'C':.28,'V':.0,'S':.0,'VIR':.0,'CH':.0,'ANU':.0},
     'CH': {'SP':.55,'C':.45,'V':.0,'S':.0,'VIR':.0,'ANU':.0,'CH':.0}}
def cond(prev):            # P(unit | prev class) = P(class|prev) * P(unit|class)
    d={}
    for u in inv:
        c=cls[u]; pc=T[prev].get(c,0.0)
        if pc==0: continue
        d[u]=pc*uni[u]
    for c in set(cls.values()):
        s=sum(uni[u] for u in inv if cls[u]==c)
        for u in inv:
            if cls[u]==c and u in d: d[u]/=s
    return d
# ---- scanning models ----
def rowcol(order, unit, R=8, Cc=10):   # steps: reach row, press, reach col, press
    i=order.index(unit); r,c=divmod(i,Cc)
    return (r+1)+(c+1), 2
def huffman_scan(prob, unit):          # binary Huffman scanning: each node = 1 step; press iff target in highlighted (heavier) child
    h=[(p,i,(u,)) for i,(u,p) in enumerate(prob.items())]; heapq.heapify(h); n=len(h); code={}
    tree={}
    while len(h)>1:
        p1,_,a=heapq.heappop(h); p2,_,b=heapq.heappop(h)
        for u in a: code[u]=code.get(u,'')+'0'    # lighter child: skip
        for u in b: code[u]=code.get(u,'')+'1'    # heavier child highlighted first: press
        heapq.heappush(h,(p1+p2,n,a+b)); n+=1
    cw=code[unit][::-1]
    return len(cw), cw.count('1')
sent = list("നീ") + ['␣'] + list("സുഖം") + ['␣'] + list("ആണോ")
prev='SP'; res={'A shipped row-column (Unicode-order grid)':[0,0],'B frequency-sorted row-column':[0,0],
                'C static entropy tree (no context)':[0,0],'D AksharaScan: context + legality constraint':[0,0]}
freq_order = rank
for u in sent:
    s,p=rowcol(inv,u);        res['A shipped row-column (Unicode-order grid)'][0]+=s; res['A shipped row-column (Unicode-order grid)'][1]+=p
    s,p=rowcol(freq_order,u); res['B frequency-sorted row-column'][0]+=s; res['B frequency-sorted row-column'][1]+=p
    s,p=huffman_scan(uni,u);  res['C static entropy tree (no context)'][0]+=s; res['C static entropy tree (no context)'][1]+=p
    s,p=huffman_scan(cond(prev),u); res['D AksharaScan: context + legality constraint'][0]+=s; res['D AksharaScan: context + legality constraint'][1]+=p
    prev=cls[u]
print(f"sentence units: {len(sent)}  ->", ' '.join(sent))
print(f"{'method':48s} {'presses':>8s} {'scan steps':>11s} {'time @1.0s':>11s} {'time @0.6s':>11s}")
for k,(s,p) in res.items(): print(f"{k:48s} {p:8d} {s:11d} {s*1.0:9.0f} s {s*0.6:9.0f} s")
