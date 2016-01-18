define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");
  var util = require("./util");

  var handler = module.exports = Object.create(baseHandler);
  var emitter;

  handler.handlesLanguage = function(language) {
    return language === "scala";
  };

  handler.init = function(callback) {
    emitter = handler.getEmitter();
    console.log("Scala outline initialized.");
    callback();
  };

  function executeEnsime(req, callback) {
    util.executeEnsime(emitter, req, callback);
  }

  handler.outline = function(doc, ast, callback) {
    executeEnsime({
      typehint: "StructureViewReq",
      fileInfo: {
        file: ".." + handler.path,
        contents: doc.getValue()
      }
    }, function(err, result) {
      if (err) return callback(err);
      console.log(result); //TODO remove

      var ol = result.view.map(convert);
      callback(false, {
        isGeneric: false,
        isUnordered: false,
        items: ol
      });
    });
  };

  function convert(obj) {
    return {
      icon: iconFor(obj.keyword),
      name: obj.name,
      pos: posFor(obj),
      displayPos: posFor(obj),
      items: obj.members.map(convert)
    };
  }

  function posFor(obj) {
    //TODO calculate from offset
    return {
      sl: 0,
      sc: 0,
      el: 0,
      ec: 0
    };
  }

  function iconFor(kw) {
    switch (kw) {
      case "object":
        return "event";
      case "class":
        return "method";
      case "trait":
        return "method2";
      case "def":
        return "property";
      case "val":
        return "property2";
      case "type":
        return "unknown2";
      default:
        return "unknown";
    }
  }
});