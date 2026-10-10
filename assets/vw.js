// Minimal renderer for the page templates: {{path}} holes in text and attributes,
// <sc-for list="{{x}}" as="y">, <sc-if value="{{x}}">, onClick="{{fn}}" and setState.
(function () {
  const HOLE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  const ONLY_HOLE = /^\{\{\s*([\w.$]+)\s*\}\}$/;

  function lookup(scope, path) {
    return path.split(".").reduce((v, k) => (v == null ? undefined : v[k]), scope);
  }
  function interpolate(str, scope) {
    return str.replace(HOLE, (_, p) => {
      const v = lookup(scope, p);
      return v == null ? "" : String(v);
    });
  }
  function resolve(str, scope) {
    const m = (str || "").trim().match(ONLY_HOLE);
    return m ? lookup(scope, m[1]) : str;
  }

  function processChildren(parent, scope) {
    Array.from(parent.childNodes).forEach((n) => processNode(n, scope));
  }

  function processNode(node, scope) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue.includes("{{")) node.nodeValue = interpolate(node.nodeValue, scope);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.localName;

    if (tag === "sc-for") {
      const list = resolve(node.getAttribute("list"), scope) || [];
      const as = node.getAttribute("as");
      const frag = document.createDocumentFragment();
      list.forEach((item) => {
        const inner = Object.assign(Object.create(scope), { [as]: item });
        Array.from(node.childNodes).forEach((c) => {
          const clone = c.cloneNode(true);
          frag.appendChild(clone);
          processNode(clone, inner);
        });
      });
      node.replaceWith(frag);
      return;
    }

    if (tag === "sc-if") {
      if (resolve(node.getAttribute("value"), scope)) {
        processChildren(node, scope);
        node.replaceWith(...Array.from(node.childNodes));
      } else {
        node.remove();
      }
      return;
    }

    Array.from(node.attributes).forEach((a) => {
      if (a.name === "onclick") {
        const fn = resolve(a.value, scope);
        node.removeAttribute("onclick");
        if (typeof fn === "function") node.addEventListener("click", fn);
      } else if (a.value.includes("{{")) {
        a.value = interpolate(a.value, scope);
      }
    });
    processChildren(node, scope);
  }

  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
    }
    setState(patch) {
      this.state = Object.assign({}, this.state, patch);
      this._render();
    }
    _mount(root, tpl) {
      this._root = root;
      this._tpl = tpl;
      this._render();
    }
    _render() {
      // Keep keyboard focus on the same button across re-renders.
      const focusables = () => Array.from(this._root.querySelectorAll("button, a[href]"));
      const idx = focusables().indexOf(document.activeElement);
      const frag = this._tpl.content.cloneNode(true);
      processChildren(frag, this.renderVals());
      this._root.replaceChildren(frag);
      if (idx >= 0) {
        const el = focusables()[idx];
        if (el) el.focus({ preventScroll: true });
      }
    }
  }

  window.DCLogic = DCLogic;
  window.mountPage = function (Component) {
    const tpl = document.getElementById("page-template");
    const root = document.getElementById("app");
    new Component({})._mount(root, tpl);
  };
})();
