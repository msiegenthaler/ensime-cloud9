define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");
  var workerUtil = require("plugins/c9.ide.language/worker_util");
  var util = require("./util");

  var handler = module.exports = Object.create(baseHandler);
  var emitter;

  handler.handlesLanguage = function(language) {
    return language === "scala";
  };

  handler.init = function(callback) {
    emitter = handler.getEmitter();
    console.log("Scala markers initialized.");
    emitter.on("event", handleEvent);
    callback();
  };

  var markers = [];
  var pending = [];

  function handleEvent(event) {
    if (event.typehint === "NewScalaNotesEvent") {
      if (event.isFull) markers = [];
      markers = markers.concat(event.notes.map(toMarker));
    }
    else if (event.typehint === "ClearAllScalaNotesEvent") {
      markers = [];
    }
    else if (event.typehint === "FullTypeCheckCompleteEvent") {
      //Typecheck done, now send the markers to the callbacks
      pending.forEach(function(p) {
        p();
      });
      pending = [];
    }
  }

  function toMarker(note) {
    var res = {
      pos: {
        sl: note.line - 1,
        sc: note.col,
        el: note.line - 1,
        ec: note.col
      },
      type: serverityToType(note.severity),
      message: note.msg
    };
    if (note.file.indexOf(handler.workspaceDir) == 0) {
      res.file = note.file.substr(handler.workspaceDir.length);
    }
    else {
      console.warn("File not in workspace: " + note.file + " (workspaceDir is " + handler.workspaceDir + ")");
      res.file = note.file;
    }
    return res;
  }

  function serverityToType(severity) {
    switch (severity.typehint) {
      case "NoteInfo":
        return "info";
      case "NoteWarn":
        return "warning";
      case "NoteError":
        return "error";
      default:
        return "error";
    }
  }

  function executeEnsime(req, callback) {
    util.executeEnsime(emitter, req, callback);
  }

  handler.analyze = function(doc, ast, options, callback) {
    var file = handler.path;
    executeEnsime({
      typehint: "TypecheckFileReq",
      fileInfo: {
        file: handler.workspaceDir + handler.path,
        contents: doc
      }
    }, function() {
      //ignore, we wait for typecheck to complete
    });

    //defer the answer until the typecheck is done.
    pending.push(function() {
      var ms = markers.filter(function(m) {
        return m.file === file;
      });
      callback(false, ms);
    });
  };
});