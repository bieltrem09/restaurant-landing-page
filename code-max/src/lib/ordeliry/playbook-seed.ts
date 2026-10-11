// Playbook inicial (seção 7 da especificação). Inserido no onboarding como entradas aprovadas e editáveis.
export const PLAYBOOK_SEED: Array<{ titulo: string; nicho: string | null; conteudo: string }> = [
  {
    "titulo": "Vídeo \"Fechando uma venda em 5 minutos\" (ligação para restaurante)",
    "nicho": "restaurante",
    "conteudo": "Roteiro que funcionou, com resultado de venda fechada e reunião marcada:\n\n1. \"Eu gostaria de falar com o dono, por favor.\"\n2. **Elogio específico:** \"Tava dando uma olhada no seu restaurante e fiquei impressionado: vocês são relativamente novos e já têm ótimas avaliações.\"\n3. **Dor como cliente:** \"Fui procurar um cardápio digital para ver o que vocês oferecem e acabei não encontrando. Vocês realmente não têm?\"\n4. **O dono admite:** \"A gente ainda não tem nada digital.\"\n5. **Virada:** \"Sem problema, essa ligação é perfeita pra você.\"\n6. **Oferta e preço:** \"Trabalho fazendo cardápios digitais para restaurantes e o preço não é problema: cobro R$ 100 por mês, já com manutenção.\"\n7. **Valor comparado:** \"Hoje você tem cardápio de papel. Quando precisa mudar algo, imprime tudo de novo. Com o digital, você tem QR code na mesa, e qualquer alteração eu faço sem cobrar nada a mais.\"\n8. **Pergunta de interesse.** O cliente se surpreende com o preço e pede um exemplo.\n9. **Reversão de risco:** \"Me manda uma foto do cardápio atual e em pouquíssimo tempo te mando ele digitalizado. Não vou te cobrar nada nesse primeiro momento. Se você gostar, a gente fecha os R$ 100 por mês.\"\n10. **Fechou.** Reunião marcada para deixar tudo pronto.\n\n**Prospecção por filtro:** buscar restaurantes por cidade e filtrar por \"sem cardápio digital\", \"só rede social\", \"cardápio em PDF\" e \"só no iFood\". Cada filtro é um funil com abordagem própria."
  },
  {
    "titulo": "Conversa — Pizzaria Cheff Gourmett (ficou sem resposta)",
    "nicho": "restaurante",
    "conteudo": "**O que aconteceu:** o cliente autorizou o exemplo (\"pode sim\"). O vendedor fez o site de exemplo, mandou o link à noite com \"desculpa a demora\" e \"me fale o que achou\", e cobrou \"o que acharam do site?\" 33 minutos depois. Não houve resposta.\n\n**Lições:**\n- Combinar o próximo passo **antes** de entregar o exemplo (dia e hora de uma ligação de 10 min).\n- Entregar com pergunta fácil e específica: \"Quer que eu já coloque o cardápio completo de vocês com o botão de pedir no WhatsApp?\"\n- Mostrar o resultado para o negócio: pedidos diretos sem taxa de marketplace, aparecer no Google.\n- Evitar erros de digitação e \"desculpa a demora\".\n- Follow-up no dia seguinte, das 14h às 17h, nunca 30 minutos depois e nunca no horário de pico (noite de pizzaria).\n- Usar o rastreamento do site de exemplo para saber se foi aberto e mandar a mensagem quando o dono estiver olhando."
  },
  {
    "titulo": "Conversa — Gil, corretora (sinais de compra fortes)",
    "nicho": "corretor",
    "conteudo": "**O que funcionou:** abertura curta, com nicho claro e pedido de permissão (\"Posso te mostrar alguns exemplos?\"). Ela respondeu e pediu os exemplos. O exemplo enviado era real e do mesmo nicho (Quartzo by Mivita).\n\n**Sinais de compra:**\n- \"Nossa, que lindo\";\n- \"e no Instagram tem como partilhar o site?\";\n- \"como funciona seu trabalho?\";\n- \"e valores?\".\n\n**Objeção de modelo:** \"Eu trabalho com todas as construtoras. Não seria um site com todos eles expostos?\"\n\n**Lições:**\n- Responder **cada pergunta** de forma direta e por escrito (áudio é complemento):\n  - sim, o link vai na bio, nos stories e no WhatsApp;\n  - existem dois formatos (vitrine com todos os imóveis, e página exclusiva por lançamento);\n  - preço de cada um;\n  - próximo passo com duas opções de horário.\n- Quando ela pergunta \"valores?\", o próximo passo é a proposta. Não é hora de mais explicação."
  },
  {
    "titulo": "Conversa — fechamento travado em \"vamos analisar\"",
    "nicho": null,
    "conteudo": "**O que aconteceu:** depois de explicar domínio e plano mensal, o vendedor perguntou \"Bora colocar o site de vocês no ar? 🚀\". A resposta foi \"Ok… vamos analisar aqui\", e a réplica foi \"podemos marcar uma ligação\".\n\n**Lições:**\n- \"Vamos analisar\" pede uma pergunta de diagnóstico: \"Claro! Para eu te ajudar na análise: o que pesa mais aí, o valor ou entender melhor o que entra no plano mensal? E mais alguém decide junto com você?\"\n- Depois, oferecer horário concreto: \"Consigo te ligar amanhã às 10h ou às 15h. Qual fica melhor?\""
  }
];
