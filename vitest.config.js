// IA-038: configuracao do Vitest pra testar o motor logico do assistente
// IA sem precisar de build/refator pra ES6 modules.
//
// jsdom: simula window, document, localStorage - necessarios porque o
// motor usa todos esses.
// setupFiles: carrega o codigo do app (js/*.js) via eval no global da
// JSDOM antes dos testes rodarem (ver tests/setup.js).

export default {
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
    globals: true, // permite usar describe/it/expect sem import
    include: ["tests/**/*.test.js"],
  },
};
