# SUSHI — Japanese Restaurant

Site premium (landing page) para restaurante de sushi: fundo preto profundo, luz dramática, acentos em vermelho japonês e dourado, com motion em GSAP + ScrollTrigger + SplitText e smooth scroll com Lenis.

## Como rodar

O site é estático (HTML + CSS + JS puro). Basta servir a pasta por HTTP — abrir o `index.html` direto do disco (`file://`) não carrega o sprite de ícones.

```bash
npx http-server -c-1 .     # ou: python3 -m http.server 8080
# abra http://localhost:8080
```

Para publicar: envie a pasta inteira para qualquer hospedagem estática (Vercel, Netlify, GitHub Pages).

## Estrutura

```
index.html                 todas as seções (header, hero, marquee, filosofia, assinaturas,
                           destaque, cardápio, ambiente, omakase, depoimentos, reservas,
                           contato, footer) + Schema.org Restaurant e Open Graph
css/styles.css             design system (tokens), layout mobile-first e breakpoints
js/menu-data.js            dados do cardápio (nomes, descrições, preços, selo do chef)
js/main.js                 interações e animações (comentadas por seção)
assets/vendor/             GSAP 3.13 (+ScrollTrigger, SplitText) e Lenis 1.3, servidos localmente
assets/img/                imagens otimizadas: AVIF + WebP + JPG/PNG
assets/originals/          fotos originais
assets/icons.svg           sprite de ícones Lucide
assets/cardapio.pdf        cardápio para download (gerado de js/menu-data.js)
tools/build-assets.py      gera assets/img e o sprite de ícones
tools/build-menu-pdf.mjs   gera assets/cardapio.pdf
```

Dependências de runtime: nenhuma via CDN além do Google Fonts (Cormorant Garamond, Pinyon Script, Montserrat, Shippori Mincho).

## Antes de publicar: troque os dados de exemplo

Endereço, telefone, WhatsApp, Instagram, e-mail, horários, preços, números (anos, clientes, nota 4,9), depoimentos e a seção "O Chef" (nome, frase e trajetória do Itamae Kenji) são **exemplos** e precisam ser trocados pelos reais:

- `index.html` — textos, links `wa.me/5511999999999`, `tel:`, endereço, horários e o JSON-LD (Schema.org) no `<head>`
- `js/main.js` — constante `WHATSAPP` e `FORM_ENDPOINT`
- `js/menu-data.js` — cardápio; depois rode `node tools/build-menu-pdf.mjs` para atualizar o PDF

### Formulário de reserva

Sem backend, o formulário valida os campos e monta uma mensagem pronta para confirmar pelo WhatsApp. Para receber os pedidos por e-mail/API, preencha `FORM_ENDPOINT` em `js/main.js` (por exemplo, um endpoint do Formspree): o formulário fará um POST em JSON.

## Imagens

As fotos foram recortadas (o recorte do niguiri remove o texto e a marca d'água da arte original), convertidas para AVIF/WebP/JPG e recebem um tratamento de cor unificado via CSS. No hero, um recorte transparente do niguiri fica **na frente** da palavra "SUSHI", e a foto completa, com máscara radial, fica atrás.

As fotos originais têm cerca de 736 px de largura, então o `srcset` vai até a largura nativa (sem ampliar artificialmente). Com fotos em alta resolução, substitua os arquivos em `assets/originals/` e rode:

```bash
pip install pillow numpy scipy
python3 tools/build-assets.py caminho/para/node_modules/lucide-static   # o argumento só é necessário para regenerar os ícones
```

As larguras 1024/1600/2400 são geradas automaticamente quando a foto de origem comporta. Se mudar o enquadramento, revise as caixas de recorte em `IMAGES`.

## Acessibilidade e performance

- HTML semântico, um único `h1`, link "pular para o conteúdo", foco visível, abas e carrossel acessíveis por teclado, `aria-label` nos botões de ícone.
- `prefers-reduced-motion`: sem smooth scroll, parallax, pin horizontal, partículas, pétalas e fumaça; o conteúdo aparece imediatamente.
- Se os scripts de animação não carregarem, todo o conteúdo fica visível (fallback em 5 s).
- Hero com preload e `fetchpriority="high"`; demais imagens com `loading="lazy"`; todas com `width`/`height` para evitar CLS. Os canvas (bokeh, fumaça, pétalas) pausam fora da tela.
