define(function(require, exports, module) {
  main.consumes = ["plugin.test", "c9.ide.language.scala"];
  main.provides = [];
  return main;

  function main(options, imports, register) {
    var test = imports["plugin.test"];

    var describe = test.describe;
    var it = test.it;
    var assert = test.assert;

    describe("c9.ide.language.scala", function() {
      // TODO
    });

    register(null, {});
  }
});