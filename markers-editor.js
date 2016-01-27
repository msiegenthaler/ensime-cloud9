define(function(require, exports, module) {
    module.exports = function(imports, consumes) {
        var Editor = imports.Editor;
        var Datagrid = imports.Datagrid;
        var ensime = imports.ensime;
        var tabManager = imports.tabManager;
        var commands = imports.commands;
        var path = require("path");

        function sortMarkers(markers) {
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

        function MarkersEditor() {
            console.log("initializing Scala MarkersEditor.");

            var currentMarkers = [];
            var currentPos = -1;

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
                    sort: sortMarkers
                }, plugin);

                function jumpToMarker(marker) {
                    if (!marker) return;
                    tabManager.open({
                        path: marker.fileFull,
                        focus: true,
                        pane: tabManager.getPanes()[0]
                    }, function(err, tab) {
                        if (err) return console.warn("Could not jump to selection " + marker.fileFull);
                        if (tab.editor && tab.editor.scrollTo)
                            tab.editor.scrollTo(marker.pos.sl, marker.pos.sc);
                    });
                }
                table.on("jumpToMarker", function() {
                    jumpToMarker(table.selectedNode());
                });

                commands.addCommand({
                    name: "jumpToMarker",
                    group: "Scala",
                    description: "Jump to the next compiler error or warning.",
                    bindKey: {
                        mac: "F4",
                        win: "F4",
                        linux: "F4"
                    },
                    isAvailable: function() {
                        return currentMarkers && currentMarkers.length > 0;
                    },
                    exec: function() {
                        if (!currentMarkers || currentMarkers.length == 0) return;
                        currentPos++;
                        if (currentPos >= currentMarkers.length) currentPos = 0;
                        jumpToMarker(currentMarkers[currentPos]);
                        table.select(currentMarkers[currentPos]);
                    }
                }, plugin);

                ensime.on("markers", function(markers) {
                    markers = sortMarkers(markers);
                    if (currentPos > -1 && currentPos < currentMarkers.length) {
                        //try to find our last position in the new markers
                        var c = currentMarkers[currentPos];
                        currentPos = markers.findIndex(function(e) {
                            return c.fileFull === e.fileFull &&
                                c.message === e.message &&
                                c.type === e.type &&
                                c.pos.sl === e.pos.sl &&
                                c.pos.sc === e.pos.sc;
                        });
                    }
                    else currentPos = -1;
                    currentMarkers = markers;
                    table.setRoot(markers);
                }, plugin);
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