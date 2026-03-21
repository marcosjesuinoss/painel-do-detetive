function toggleAccordion(element) {
  const item = element.parentElement;
  const aberto = document.querySelector(".accordion .item.ativo");

  if (aberto && aberto !== item) {
    fecharItem(aberto);
  }

  if (item.classList.contains("ativo")) {
    fecharItem(item);
  } else {
    abrirItem(item);
  }
}

function abrirItem(item) {
  const conteudo = item?.querySelector(".conteudo");
  if (!conteudo) return;
  const titulo = item.querySelector(".titulo");
  item.classList.add("ativo");
  conteudo.style.maxHeight = conteudo.scrollHeight + "px";
  if (titulo) {
    titulo.setAttribute("aria-expanded", "true");
  }
}

function fecharItem(item) {
  const conteudo = item?.querySelector(".conteudo");
  if (!conteudo) return;
  const titulo = item.querySelector(".titulo");
  conteudo.style.maxHeight = "0px";
  item.classList.remove("ativo");
  if (titulo) {
    titulo.setAttribute("aria-expanded", "false");
  }
}

function fecharTodosAccordions() {
  document.querySelectorAll(".accordion .item.ativo").forEach(fecharItem);
}
