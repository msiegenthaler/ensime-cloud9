define(function(require, exports, module) {
    module.exports = function(imports, consumes) {
        var Editor = imports.Editor;
        var Datagrid = imports.Datagrid;
        var ensime = imports.ensime;
        var tabManager = imports.tabManager;
        var path = require("path");


        function MarkersEditor() {
            console.log("initializing Scala MarkersEditor.");

            var workspaceDir = undefined;

            var plugin = new Editor("Ensime", consumes, []);
            plugin.on("draw", function(e) {
                var container = e.htmlNode;
                var table = new Datagrid({
                    container: container,

                    columns: [{
                        caption: "",
                        width: "40",
                        getHTML: function(marker) {
                            return `<div class="ace_gutter-layer"><span class="ace_gutter-cell ace_${marker.type}"></span></div>`;
                        },
                        getText: function(marker) {
                            return marker.type;
                        }
                    }, {
                        caption: "Message",
                        value: "message",
                        width: "60%",
                    }, {
                        caption: "Location",
                        getText: function(marker) {
                            var name = path.basename(marker.file, ".scala");
                            var dir = marker.file.substring(1);
                            var line = marker.pos.sl;
                            return `${name}:${line} (${dir})`;
                        },
                        width: "30%"
                    }],

                    sort: function(markers) {
                        function sn(severity) {
                            switch (severity) {
                                case "error":
                                    return 100;
                                case "warning":
                                    return 10;
                                case "info":
                                    return 1;
                                default:
                                    return 0;
                            }
                        }

                        function order(a, b) {
                            var asn = sn(a.type);
                            var bsn = sn(b.type);
                            if (asn > bsn) return -1;
                            if (asn < bsn) return 1;
                            if (a.file < b.file) return -1;
                            if (a.file > b.file) return 1;
                            if (a.pos.sl < b.pos.sl) return -1;
                            if (a.pos.sl > b.pos.sl) return 1;
                            if (a.message == b.message) return 0;
                            return -1;
                        }
                        return markers.sort(order);
                    }
                }, plugin);

                function openMarker() {
                    var sel = table.selectedNode;
                    if (!sel) return;
                    tabManager.open({
                        path: sel.fileFull,
                        focus: true,
                        pane: tabManager.getPanes()[0]
                    }, function(err, tab) {
                        if (err) return console.warn("Could not jump to selection " + sel.fileFull);
                        if (tab.editor && tab.editor.scrollTo)
                            tab.editor.scrollTo(sel.pos.sl, sel.pos.sc);
                    });
                }
                table.on("afterChoose", openMarker);

                ensime.on("markers", function(markers) {
                    table.setRoot(markers);
                }, plugin);
            });

            plugin.on("config", function(config) {
                workspaceDir = config.workspaceDir;
            });

            plugin.on("load", function() {
                console.info("Loading Scala Markers Editor...");
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