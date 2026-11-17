/* =====================================================
   VIRADA DE PÁGINA
   O conteúdo de cada "spread" (par de folhas) fica no HTML,
   dentro de #fonte-spreads. Para criar mais páginas, basta
   copiar um <section class="spread"> e editar.
   ===================================================== */
(() => {
    const caderno = document.getElementById("caderno");
    const fonte = document.getElementById("fonte-spreads");
    const baseEsq = document.getElementById("conteudo-esq");
    const baseDir = document.getElementById("conteudo-dir");
    const folha = document.getElementById("folha");
    const frente = folha.querySelector(".frente");
    const verso = folha.querySelector(".verso");
    const dobraDir = document.getElementById("dobra-dir");
    const dobraEsq = document.getElementById("dobra-esq");

    const spreads = [...fonte.querySelectorAll(".spread")].map((s) => ({
        esq: s.querySelector(".conteudo-esq").innerHTML,
        dir: s.querySelector(".conteudo-dir").innerHTML,
    }));

    let atual = 0;
    let virando = false;

    const duracaoMs = () =>
        parseFloat(getComputedStyle(caderno).getPropertyValue("--duracao")) * 1000 || 900;

    function mostrarSpread() {
        baseEsq.innerHTML = spreads[atual].esq;
        baseDir.innerHTML = spreads[atual].dir;
        baseEsq.scrollTop = 0;
        baseDir.scrollTop = 0;
        dobraDir.hidden = atual >= spreads.length - 1;   // sem próxima página
        dobraEsq.hidden = atual <= 0;                    // sem página anterior
    }

    function preencherFace(face, lado, html) {
        face.classList.remove("pagina-esq", "pagina-dir");
        face.classList.add("pagina", lado === "esq" ? "pagina-esq" : "pagina-dir");
        face.querySelector(".conteudo").innerHTML = html;
    }

    function virar(direcao) {
        const destino = atual + (direcao === "avancar" ? 1 : -1);
        if (virando || destino < 0 || destino >= spreads.length) return;
        virando = true;
        dobraDir.hidden = true;
        dobraEsq.hidden = true;

        if (direcao === "avancar") {
            // a folha da direita sobe e vira para a esquerda
            preencherFace(frente, "dir", spreads[atual].dir);
            preencherFace(verso, "esq", spreads[destino].esq);
            baseDir.innerHTML = spreads[destino].dir;        // aparece por baixo
        } else {
            // a folha da esquerda vira para a direita
            preencherFace(frente, "esq", spreads[atual].esq);
            preencherFace(verso, "dir", spreads[destino].dir);
            baseEsq.innerHTML = spreads[destino].esq;
        }

        folha.className = "folha-virando ativa " + direcao;
        void folha.offsetWidth;                              // força o navegador a registrar o estado inicial
        folha.classList.add("girando");

        setTimeout(() => {
            atual = destino;
            mostrarSpread();
            folha.className = "folha-virando";
            virando = false;
        }, duracaoMs() + 60);
    }

    dobraDir.addEventListener("click", () => virar("avancar"));
    dobraEsq.addEventListener("click", () => virar("voltar"));

    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") virar("avancar");
        if (e.key === "ArrowLeft") virar("voltar");
    });

    mostrarSpread();
})();
