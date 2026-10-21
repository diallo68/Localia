# RGPD (règlement (UE) 2016/679) en Markdown, depuis les pages de la CNIL (texte officiel publié par
# l'Office des publications de l'UE, réutilisation libre avec mention de la source).
# EUR-Lex refuse les téléchargements automatiques (code 202, 20 oct. 2026) : on lit les pages de la CNIL
# (cnil.html pour les considérants, chapitre1.html à chapitre11.html), enregistrées dans le dossier courant.
# Usage : python3 -I assembler_rgpd.py   (écrit rgpd.md)
import html, re
def texte(fragment):
    f = re.sub(r"<ol[^>]*start=\"(\d+)\"[^>]*>\s*<li[^>]*>", lambda m: f"\n\n{m.group(1)}. ", fragment)
    f = re.sub(r"<ol[^>]*>\s*<li[^>]*>", "\n\n1. ", f)
    f = re.sub(r"</?(p|li|blockquote|ol|ul|div|br|hr)[^>]*>", "\n\n", f)
    f = re.sub(r"<[^>]+>", "", f)
    f = html.unescape(f).replace("\xa0", " ")
    f = re.sub(r"[ \t]+", " ", f)
    return "\n\n".join(p.strip() for p in re.split(r"\n\s*\n", f) if p.strip())
sortie = ["# Règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 (règlement général sur la protection des données)", "## Considérants"]
s = open("cnil.html").read()
for m in re.finditer(r"<h4 class=\"rtecenter\">.*?\((\d+)\)</h4>(.*?)(?=<h4|<div class=\"page--tools)", s, re.S):
    sortie.append(f"### Considérant ({m.group(1)})")
    sortie.append(texte(m.group(2)))
for i in range(1, 12):
    s = open(f"chapitre{i}.html").read()
    titre = html.unescape(re.sub(r"<[^>]+>", "", re.search(r"<h1[^>]*>(.*?)</h1>", s, re.S).group(1))).strip()
    s = re.sub(r"<script.*?</script>", "", s, flags=re.S)
    debut = re.search(r"<h[23][ >]", s[s.find('class="page--tools'):]).start() + s.find('class="page--tools')
    fins = [x for x in (s.find("<footer", debut), s.find("Besoin d'aide", debut), s.find("</article>", debut)) if x > 0]
    corps = s[debut:min(fins) if fins else len(s)]
    sortie.append(f"## {titre}")
    for m in re.finditer(r"<h([23])[^>]*>(.*?)</h\1>(.*?)(?=<h[23][ >]|$)", corps, re.S):
        t = html.unescape(re.sub(r"<[^>]+>", "", m.group(2))).replace("\xa0", " ").strip()
        sortie.append(("### " if m.group(1) == "2" else "#### ") + t)
        x = texte(m.group(3))
        if x:
            sortie.append(x)
md = "\n\n".join(sortie) + "\n"
open("rgpd.md", "w").write(md)
print(len(md), "caractères ;", md.count("\n#### Article"), "articles ;", md.count("### Considérant"), "considérants")
