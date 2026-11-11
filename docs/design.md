# Identidade visual

Direção: **papel de revisão**, a mesma do RefactorAI. A GenSprint refaz sites antigos; a identidade é a de quem revisa um texto e devolve marcado.

## O que as duas marcas dividem

| Elemento | GenSprint (este repo) | RefactorAI |
|---|---|---|
| Tokens de cor, forma, espaço e motion | `site/css/base.css`, prefixo `--gs-` | `frontend/public/css/base.css`, prefixo `--ra-` |
| Fontes | Bricolage Grotesque (títulos), Instrument Sans (texto), JetBrains Mono (URLs, rótulos), locais | as mesmas |
| Cor de ação | verdete `--gs-accent` (`#0b6b57` claro, `#3dd1aa` escuro) | `--ra-accent` |
| Assinatura | marca-texto `--gs-marker` (`#f6c945`) em `<mark>` de título | marca-texto sob o título de página e no login |
| Tema | claro por padrão, escuro por `prefers-color-scheme` ou `data-theme`; chave `gensprint_theme` | idem; chave `refactorai_theme` |

Os valores são idênticos de propósito. `base.css` daqui nasceu de uma cópia com troca de prefixo: quando um token mudar no RefactorAI, repita aqui (e vice-versa) e rode `npm test`.

## O que é só da GenSprint

- **Laranja `--gs-brand-orange`** vive só no logotipo. Não é cor de ação nem de destaque.
- **Logotipo** inline como `<symbol id="gs-logo">`: a parte clara do original usa `--gs-text`, então funciona nos dois temas. `site/assets/logo.svg` é a versão para fundo claro (Schema.org, og-image).

## Onde as marcas se encontram na página

1. **Comparador do hero**: a barra que varre o site velho é o marca-texto, a mesma varredura da demonstração do login do RefactorAI.
2. **Bloco RefactorAI** (`#refactorai`): sempre escuro, como o painel lateral do login. Usa a marca "R" com o traço amarelo e o slogan do produto, "Site antigo, refeito em minutos."
3. **Links diretos**: "Entrar" na navegação, "Já sou cliente: entrar" no bloco e "Entrar no RefactorAI" no rodapé apontam para `https://refactorai.gensprint.com.br/`.
4. **Verbos do produto**: "Baixa, Analisa, Gera" aparecem no log do bloco, como no login.

## Motion

| Momento | O que acontece |
|---|---|
| Carga | título sobe linha a linha, marca-texto se desenha, comparador varre do "antes" ao "depois" e para no meio |
| Comparador | arrastável (é um `input type="range"`: funciona com teclado e leitor de tela) |
| Rolagem | seções entram com subida curta; a linha dos cinco passos se preenche conforme a rolagem |
| Relatório | notas sobem do valor antigo ao novo, barras mudam de vermelho para verde |
| Bloco RefactorAI | log aparece linha a linha, o verbo ativo acende |
| AI-Ready | a resposta do assistente é digitada |
| Faixa | "o que a revisão confere" corre em loop, pausa no hover |

Só `transform`, `opacity` e `clip-path`. `prefers-reduced-motion` mostra tudo no estado final, sem loop.

## Texto

Frases curtas, voz ativa, segunda pessoa. Sem travessão. Sem número sem fonte. O botão diz o que acontece ("Enviar pelo WhatsApp").
