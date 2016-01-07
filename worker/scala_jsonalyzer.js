define(function(require, exports, module) {
  var jsonalyzer = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_worker");
  var PluginBase = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");
  var ctagsUtil = require("plugins/c9.ide.language.jsonalyzer/worker/ctags/ctags_util");

  var handler = module.exports = Object.create(PluginBase);
  handler.languages = ["scala"];
  handler.extensions = ["scala"];


  // taken from https://github.com/ceedubs/sbt-ctags
  var TAGS = [{
    regex: /(?:^|\n)[ \t]*(?:private|protected)?[ \t]*(?:(?:package|abstract|final|sealed|implicit|lazy)[ \t]*)*(?:private|protected)?[ \t]*object[ \t]+([a-zA-Z0-9_]+)/g,
    kind: "objects",
  }, {
    regex: /(?:^|\n)[ \t]*(?:private|protected)?[ \t]*(?:(?:abstract|final|sealed|implicit|lazy)[ \t]*)*(?:private|protected)?[ \t]*case object[ \t]+([a-zA-Z0-9_]+)/g,
    kind: "case objects",
  }, {
    regex: /(?:^|\n)[ \t]*(?:private|protected)?[ \t]*(?:(?:abstract|final|sealed|implicit|lazy)[ \t]*)*(?:private|protected)?[ \t]*class[ \t]+([a-zA-Z0-9_]+)/g,
    kind: "classes",
  }, {
    regex: /(?:^|\n)[ \t]*(?:private|protected)?[ \t]*(?:(?:abstract|final|sealed|implicit|lazy)[ \t]*)*(?:private|protected)?[ \t]*case class[ \t]+([a-zA-Z0-9_]+)/g,
    kind: "case classes",
  }, {
    regex: /(?:^|\n)[ \t]*(?:private|protected)?[ \t]*(?:(?:abstract|final|sealed|implicit|lazy)[ \t]*)*(?:private|protected)?[ \t]*trait[ \t]+([a-zA-Z0-9_]+)/g,
    kind: "trait",
  }, {
    regex: /(?:^|\n)[ \t]*(?:private|protected)?[ \t]*type[ \t]+([a-zA-Z0-9_]+)/g,
    kind: "types",
    indent: 1
  }, {
    regex: /(?:^|\n)[ \t]*(?:private|protected)?[ \t]*(?:(?:abstract|final|sealed|implicit|lazy)[ \t]*)*def[ \t]+([a-zA-Z0-9_]+)/g,
    kind: "methods",
    indent: 1
  }, {
    regex: /(?:^|\n)[ \t]*(?:private|protected)?[ \t]*(?:(?:abstract|final|sealed|implicit|lazy)[ \t]*)*val[ \t]+([a-zA-Z0-9_]+)/g,
    kind: "constants",
    indent: 1
  }, {
    regex: /(?:^|\n)[ \t]*(?:private|protected)?[ \t]*(?:(?:abstract|final|sealed|implicit|lazy)[ \t]*)*var[ \t]+([a-zA-Z0-9_]+)/g,
    kind: "variables",
    indent: 1
  }, {
    regex: /(?:^|\n)[ \t]*package[ \t]+([a-zA-Z0-9_.]+)/g,
    kind: "packages"
  }, {
    regex: /(?:^|\n)[ \t]*import\s+(.*)/g,
    kind: "imports"
  }];
  var GUESS_FARGS = true;
  var EXTRACT_DOCS = true;

  handler.analyzeCurrent = function(path, doc, ast, options, callback) {
    if (doc === "" || doc.length > jsonalyzer.getMaxFileSizeSupported())
      return callback(null, {});

    var results = {};
    TAGS.forEach(function(tag) {
      if (tag.kind === "imports" || tag.kind === "packages")
        return;
      ctagsUtil.findMatchingTags(path, doc, tag, GUESS_FARGS, EXTRACT_DOCS, results);
    });

    return callback(null, {
      properties: results
    });
  };
  handler.analyzeOthers = handler.analyzeCurrentAll;

  handler.findImports = function(path, doc, ast, options, callback) {
    callback(null, ctagsUtil.findMatchingOpenFiles(path));
  };
});