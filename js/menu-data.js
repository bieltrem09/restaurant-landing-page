/* Cardápio — edite aqui nomes, descrições e preços.
   `chef: true` mostra o selo "recomendação do chef".
   `img` = foto lateral da aba; `thumb` = miniatura que segue o cursor. */
window.MENU = {
  niguiris: {
    label: "Niguiris",
    img: "niguiris",
    items: [
      { name: "Sake Aburi", desc: "Salmão maçaricado, maionese de yuzu e cebolinha (2 un.)", price: 28, chef: true, thumb: "niguiri" },
      { name: "Sake", desc: "Salmão fresco sobre arroz temperado na hora (2 un.)", price: 22, thumb: "niguiris" },
      { name: "Sake Goma", desc: "Salmão com gergelim negro tostado e sal maldon (2 un.)", price: 24, thumb: "niguiris" },
      { name: "Maguro", desc: "Atum vermelho com pincelada de shoyu envelhecido (2 un.)", price: 32, thumb: "niguiris" },
      { name: "Hamachi", desc: "Olho-de-boi com raspas de limão-siciliano (2 un.)", price: 34, chef: true, thumb: "niguiris" },
      { name: "Ebi", desc: "Camarão cozido no ponto, com molho tarê da casa (2 un.)", price: 26, thumb: "niguiris" },
    ],
  },
  uramakis: {
    label: "Uramakis",
    img: "uramakis",
    items: [
      { name: "Uramaki Tobiko", desc: "Salmão, avocado e cream cheese, coberto de ovas de peixe-voador (8 un.)", price: 46, chef: true, thumb: "uramakis" },
      { name: "Uramaki Aburi", desc: "Salmão maçaricado por cima, molho tarê e cebolinha (8 un.)", price: 48, thumb: "niguiri" },
      { name: "Philadelphia", desc: "Salmão, cream cheese e cebolinha (8 un.)", price: 38, thumb: "uramakis" },
      { name: "Ebi Tempurá", desc: "Camarão empanado, maionese picante e crispy de couve (8 un.)", price: 44, thumb: "uramakis" },
      { name: "Hossomaki Tobiko", desc: "Rolinho fino de alga com tobiko e avocado (6 un.)", price: 30, thumb: "uramakis" },
    ],
  },
  sashimis: {
    label: "Sashimis",
    img: "combinado",
    items: [
      { name: "Sashimi de Salmão", desc: "Cortes generosos da barriga e do lombo (8 fatias)", price: 54, thumb: "combinado" },
      { name: "Sashimi de Atum", desc: "Atum vermelho, cortado na hora (8 fatias)", price: 64, thumb: "combinado" },
      { name: "Usuzukuri de Peixe Branco", desc: "Fatias finíssimas com ponzu e momiji oroshi", price: 58, chef: true, thumb: "combinado" },
      { name: "Trio do Mar", desc: "Salmão, atum e peixe branco do dia (12 fatias)", price: 82, thumb: "combinado" },
    ],
  },
  temakis: {
    label: "Temakis",
    img: "detalhe",
    items: [
      { name: "Temaki Salmão", desc: "Salmão picado na faca, cebolinha e gergelim", price: 34, thumb: "detalhe" },
      { name: "Temaki Aburi", desc: "Salmão maçaricado com maionese de yuzu", price: 38, chef: true, thumb: "niguiri" },
      { name: "Temaki Tobiko", desc: "Salmão, avocado e ovas de tobiko", price: 40, thumb: "detalhe" },
      { name: "Temaki Ebi", desc: "Camarão empanado, alface e molho spicy", price: 39, thumb: "combinado" },
    ],
  },
  quentes: {
    label: "Quentes",
    img: "niguiri",
    items: [
      { name: "Salmão Aburi na Pedra", desc: "Lombo selado na chama, servido sobre pedra quente com tarê", price: 72, chef: true, thumb: "niguiri" },
      { name: "Ebi Tempurá", desc: "Camarões em massa leve e crocante, molho tentsuyu (6 un.)", price: 58, thumb: "combinado" },
      { name: "Gyoza", desc: "Pastéis japoneses de porco grelhados na chapa (6 un.)", price: 36, thumb: "combinado" },
      { name: "Missoshiru", desc: "Caldo de missô, tofu, wakame e cebolinha", price: 18, thumb: "combinado" },
    ],
  },
  combinados: {
    label: "Combinados",
    img: "chef",
    items: [
      { name: "Combinado do Chef", desc: "Seleção do dia em pedra vulcânica: niguiris, hossomakis e gari (20 peças)", price: 129, chef: true, thumb: "chef" },
      { name: "Combinado Sake", desc: "Só salmão: sashimis, niguiris e uramakis (24 peças)", price: 119, thumb: "chef" },
      { name: "Barco para Dois", desc: "Sashimis, niguiris, uramakis e hossomakis (40 peças)", price: 229, thumb: "combinado" },
      { name: "Omakase no Balcão", desc: "12 a 15 tempos escolhidos pelo itamae — somente com reserva", price: 390, chef: true, thumb: "niguiri" },
    ],
  },
};
