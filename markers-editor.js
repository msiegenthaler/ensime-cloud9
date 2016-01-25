define(function(require, exports, module) {
    module.exports = function(imports, consumes) {
        var Editor = imports.Editor;
        var ui = imports.ui;

        function MarkersEditor() {
            console.warn("MarkersEditor")

            var plugin = new Editor("Ensime", consumes, []);
            plugin.on("draw", function(e) {
                console.warn("Drawing...")
                var container = e.htmlNode;
                var nodes = ui.insertHtml(container, "<h1>Hello there!</h1>", plugin);
            });
            plugin.on("load", function() {
                console.warn("Load...")
            });
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                doc.title = "Errors and Warnings";
                doc.meta.ensimeMarkersEditor = true;
            });

            plugin.freezePublicAPI({});
            plugin.load(null, "ensimeMarkers");
            return plugin;
        }

        return MarkersEditor;
    };
});