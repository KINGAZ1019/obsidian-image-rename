"use strict";
const fs = require("node:fs");
const path = require("node:path");
const upstream = fs.readFileSync(path.join(__dirname, "src/upstream.js"), "utf8");
const naming = fs.readFileSync(path.join(__dirname, "src/naming.js"), "utf8");
let adapter = fs.readFileSync(path.join(__dirname, "src/adapter.js"), "utf8");
adapter = adapter.replace('require("./upstream.js").default', "module.exports.default")
  .replace('require("./naming.js")', "namingModule.exports");
const bundle = upstream + "\n\n// Local research workflow adaptation (MIT).\n(() => {\n" +
  "const namingModule = { exports: {} };\n(function(module, exports) {\n" + naming +
  "\n})(namingModule, namingModule.exports);\n" + adapter + "\n})();\n";
fs.writeFileSync(path.join(__dirname, "main.js"), bundle);
console.log("Built research-image-rename/main.js (" + Buffer.byteLength(bundle) + " bytes)");
