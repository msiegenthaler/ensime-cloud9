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

      var ol = result.view.map(function(e) {
        return convert(doc, e);
      });
      callback(false, {
        isGeneric: false,
        isUnordered: false,
        items: ol
      });
    });
  };

  function convert(doc, obj) {
    var pos = posFor(doc, obj);
    var result = {
      icon: iconFor(obj.keyword),
      name: obj.name,
      pos: pos,
      displayPos: pos
    };
    if (obj.members && obj.members.length > 0)
      result.items = obj.members.filter(function(e) {
        return e.keyword;
      }).map(function(e) {
        return convert(doc, e);
      });
    return result;
  }

  function posFor(doc, obj) {
    if (!obj.position) return {
      sl: 0,
      sc: 0,
      el: 0,
      ec: 0
    };
    var pos = doc.indexToPosition(obj.position.offset);
    return {
      sl: pos.row,
      sc: pos.column,
      el: pos.row,
      ec: pos.column
    };
  }

  function iconFor(kw) {
    switch (kw) {
      case "object":
        return "property";
      case "class":
        return "property2";
      case "trait":
        return "property2";
      case "def":
        return "event";
      case "val":
        return "method2";
      case "type":
        return "unknown2";
      default:
        return "unknown";
    }
  }
});