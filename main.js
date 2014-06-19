var weave = {
	nodes: [],
	edges: [],
	lineSegs: [], // Might be optional
	lines: [],
	highlightNode: null,
	offsetX: 0,
	offsetY: 0,
	mode: "create"
}

var _nextId = 0;
function getId () {
	return _nextId++;
}

function createNode (x, y) {
	var newNode = {
		id: getId(),
		x: x,
		y: y
	}
	weave.nodes.push(newNode);
	return newNode;
}

function createEdge (n1, n2, type) {
	type = type || "cross"; // cross, parallel, or wall
	if (!n1 || !n2) {
		throw new Error("No nodes, no go");
	}

	// Quadrant layout
	//   		 q2 | q1
	//   start o---------o end
	//     		 q3 | q4

	var newEdge = {
		id: getId(),
		start: n1,
		end: n2,
		type: type,
		q1: quad(),
		q2: quad(),
		q3: quad(),
		q4: quad()
	}
	weave.edges.push(newEdge);
	return newEdge;
}

function quadrant () {
	return {
		internal: undefined, // Quad connected to on same edge
		external: undefined // Quad connected to on nearby edge
	}
}
var quad = quadrant;


function getNodeEdges (node) {
	var edges = [];
	for (var i = 0; i < weave.edges.length; i++) {
		var e = weave.edges[i];
		if (e.start === node || e.end === node) {
			edges.push(e);
		}
	};
	return edges;
}

// Find all the connections between crossings
function recalculate (canvas) {
	for (var i = 0; i < weave.edges.length; i++) {
		var e = weave.edges[i];
		var quads = ["q1", "q2", "q3", "q4"];
		quads.forEach(function(q) {
			e[q].external = null;
			e[q].internal = null;
		})
	}
	for (var i = 0; i < weave.edges.length; i++) {
		var e = weave.edges[i];
		if (!e.q1.external) {
			makeConnection("q1", e, "end", true);
		}
		if (!e.q2.external) {
			makeConnection("q2", e, "start", false);
		}
		if (!e.q3.external) {
			makeConnection("q3", e, "start", true);
		}
		if (!e.q4.external) {
			makeConnection("q4", e, "end", false);
		}

		switch(e.type) {
			case "cross":
				e.q1.internal = {edge: e, quad: "q3"};
				e.q3.internal = {edge: e, quad: "q1"};
				e.q2.internal = {edge: e, quad: "q4"};
				e.q4.internal = {edge: e, quad: "q2"};
				break;
			case "parallel":
				e.q1.internal = {edge: e, quad: "q4"};
				e.q4.internal = {edge: e, quad: "q1"};
				e.q2.internal = {edge: e, quad: "q3"};
				e.q3.internal = {edge: e, quad: "q2"};
				break;
			case "wall":
				e.q1.internal = {edge: e, quad: "q2"};
				e.q2.internal = {edge: e, quad: "q1"};
				e.q3.internal = {edge: e, quad: "q4"};
				e.q4.internal = {edge: e, quad: "q3"};
				break;
			default:
				console.error("Invalid type for edge " + e);

		}
	};
	draw(canvas);
}

function makeConnection (q, edge, basepoint, closestClockwise) {
	var closestEdge = Utilities.getClosest(edge, basepoint, closestClockwise);
	var targetQuad;
	var inSeries = !(closestEdge[basepoint] === edge[basepoint]);

	switch (q) {
		case "q1":
			targetQuad = inSeries ? "q2" : "q4";
			break;
		case "q2":
			targetQuad = inSeries ? "q1" : "q3";
			break;
		case "q3":
			targetQuad = inSeries ? "q4" : "q2";
			break;
		case "q4":
			targetQuad = inSeries ? "q3" : "q1";
			break;
		default:
			console.warn("param 'q' should be in q1 thru q4");
	}

	// console.log("Making connection: " + q + " " + targetQuad + " from edge " + edge.id + " to " + closestEdge.id);
	
	if (closestEdge[targetQuad].external) {
		console.error("Already connected")
		debugger;
	}
	closestEdge[targetQuad].external = {edge: edge, quad: q};
	edge[q].external = {edge: closestEdge, quad: targetQuad};
}
function draw (canvas) {
	var ctx = canvas.getContext("2d");

	ctx.fillStyle = "white"
	ctx.fillRect(0,0, canvas.width, canvas.height)

	for (var i = 0; i < weave.edges.length; i++) {
		var e = weave.edges[i];
		var pt1 = e.start;
		var pt2 = e.end;
		var quads = ["q1", "q2", "q3", "q4"];
		quads.forEach(function(q) {
			e[q].internal.drawn = false;
			e[q].external.drawn = false;
		});
		// pt1:  {x:#, y:#}  source position in screen coords
		// pt2:  {x:#, y:#}  target position in screen coords

		// draw a line from pt1 to pt2
		ctx.strokeStyle = "rgba(0,0,0, .333)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(pt1.x + weave.offsetX, pt1.y + weave.offsetY);
		ctx.lineTo(pt2.x + weave.offsetX, pt2.y + weave.offsetY);
		ctx.stroke();

		// ctx.font="30px Verdana";
		// ctx.fillStyle = "red";
		// ctx.fillText("e" + e.id , (pt1.x + pt2.x)/2 + weave.offsetX, (pt1.y + pt2.y)/2 + weave.offsetY);

		var quads = ["q1", "q2", "q3", "q4"];
		quads.forEach(function(q) {
			var t = getCoord({edge: e, quad: q});
			// ctx.fillText(q,t.x, t.y);
		})
	}

	for (var i = 0; i < weave.nodes.length; i++) {
		var pt = weave.nodes[i];

		var w = 10;
		ctx.fillStyle = "green";

        ctx.beginPath();
		ctx.arc(pt.x + weave.offsetX,pt.y + weave.offsetY,5,0,Math.PI*2,true);

		ctx.fill();
	};

	for (var i = 0; i < weave.edges.length; i++) {
		var e = weave.edges[i];
		var quads = ["q1", "q2", "q3", "q4"];
		quads.forEach(function(q) {
			if (!e[q].external.drawn) {
				drawWeave(ctx, e, q, "external");
			}
			if (!e[q].internal.drawn) {
				drawWeave(ctx, e, q, "internal");
			}
		})
	};

	if (weave.highlightNode) {
		var w = 10;
		ctx.fillStyle = "orange";

        ctx.beginPath();
		ctx.arc(weave.highlightNode.x + weave.offsetX, weave.highlightNode.y + weave.offsetY,5,0,Math.PI*2,true);

		ctx.fill();
	}
}

function drawWeave (ctx, initEdge, q, conn) {
	conn = conn || "external";

	var cnctn = initEdge[q][conn]; // Edge and quad that the current edge and quadrant is connected to
	var oppConn = (conn === "external") ? "internal" : "external";

	var begin = getCoord({edge: initEdge, quad: q});
	var end = getCoord(cnctn);
	ctx.strokeStyle = "rgba(40,20,20, 1)";
	ctx.lineWidth=20;
	ctx.beginPath();
	ctx.moveTo(begin.x + weave.offsetX, begin.y + weave.offsetY);

	if (conn === "external") {
		var control1 = {x: begin.x * 2 - getCoord( initEdge[q].internal).x,
						y: begin.y * 2 - getCoord( initEdge[q].internal).y};

		var control2 = {x: end.x * 2 - getCoord( cnctn.edge[cnctn.quad].internal).x,
						y: end.y * 2 - getCoord( cnctn.edge[cnctn.quad].internal).y};

		ctx.bezierCurveTo(
			control1.x + weave.offsetX,
			control1.y + weave.offsetY,
			control2.x + weave.offsetX,
			control2.y + weave.offsetY,
			end.x + weave.offsetX,
			end.y + weave.offsetY);// From quad to quad, handle points are opposite other quads on each end
	    ctx.stroke();

		ctx.strokeStyle = "white";
		ctx.lineWidth=14;
		ctx.beginPath();
		ctx.moveTo(begin.x + weave.offsetX, begin.y + weave.offsetY);
		ctx.bezierCurveTo(
			control1.x + weave.offsetX,
			control1.y + weave.offsetY,
			control2.x + weave.offsetX,
			control2.y + weave.offsetY,
			end.x + weave.offsetX,
			end.y + weave.offsetY); // From quad to quad, handle points are opposite other quads on each end
	    ctx.stroke();

	} else {
		if ((q == "q1" && cnctn.quad == "q3") || (q == "q3" && cnctn.quad == "q1")) {
			// Draw the other
			drawWeave(ctx, initEdge, "q2", "internal")
		}
		ctx.lineWidth=20;
		ctx.beginPath();
		ctx.moveTo(begin.x + weave.offsetX, begin.y + weave.offsetY);
		ctx.strokeStyle = "rgba(40,20,20, 1)";
		ctx.lineTo(end.x + weave.offsetX, end.y + weave.offsetY);
		ctx.stroke();

		ctx.strokeStyle = "white";
		ctx.lineWidth=14;
		ctx.beginPath();
		ctx.moveTo(begin.x + weave.offsetX, begin.y + weave.offsetY);
		ctx.lineTo(end.x + weave.offsetX, end.y + weave.offsetY);
		ctx.stroke();
	}
	initEdge[q][conn].drawn = true;
	cnctn.edge[cnctn.quad][conn].drawn = true;
}

// Gets the 'coordinate' of a quadrant (ie a point at a 45 degree angle from the center)
function getCoord (info) {
	var os = 30; // Quad distance from center of edge

	var e = info.edge; // Object (edge)
	var quad = info.quad; // String
	var vector = Line(e.start, e.end).toVector();
	var mag = Utilities.magnitude(vector);

	var center = {	x: vector.x / 2 + e.start.x,
					y: vector.y / 2 + e.start.y
				}

	var root2 = 1.4142;
	var matrix;
	// Rotation matrix is [cos, -sin, sin, cos] <- flattend 2x2 matrix
	switch (quad) {
		case "q1":
			matrix = [1/root2, -1/root2, 1/root2, 1/root2]; // angle = 45
			break;
		case "q2":
			matrix = [-1/root2, -1/root2, 1/root2, -1/root2]; // 225
			break;
		case "q3":
			matrix = [-1/root2, 1/root2, -1/root2, -1/root2]; // 135
			break;
		case "q4":
			matrix = [1/root2, 1/root2, -1/root2, 1/root2]; // 315
			break;
		default:
			console.warn("param 'q' should be in q1 thru q4");
			return;
	}
	var tempV = {x: vector.x / mag * os, y: vector.y / mag * os};
	var quadOffset = {	x: tempV.x * matrix[0] + tempV.y * matrix[1],
						y: tempV.x * matrix[2] + tempV.y * matrix[3] }

	return {	x: center.x + quadOffset.x,
				y: center.y + quadOffset.y
			}
}



function initMouseHandling(canvas) {
	// no-nonsense drag and drop (thanks springy.js)
	var target = null;
	var startNode = null;
	var panMode = false;
	var dragging = false;
	var panning = false;
	var highlightRadius = 50;
	var previousMouseP = {x: 0, y: 0};

	// Returns true if an edge already exists between the same nodes
	function edgeExists(start, end, edgeArray) {
		edgeArray = edgeArray || weave.edges;
		for (var i = 0; i < edgeArray.length; i++) {
			var e = edgeArray[i];
			if ((e.start == start && e.end == end) ||
				(e.end == start && e.start == end)) {
				return true;
			}
		};
		return false;
	}

	// TODO - check if edges intersect before allowing placement
	// Allow cancelation
	function endDrag (_mouseP) {
		// Ignore target node or node on other end of edge
		var secondNearest = Utilities.getNearestNode(weave.nodes, _mouseP.x, _mouseP.y, highlightRadius, [target, startNode]); 
		startNode = null;
		if (secondNearest) {
			var edges = getNodeEdges(target);
			var edges2 = getNodeEdges(secondNearest);
			edges.forEach(function (edge) {
				if (edge.start == target) {
					edge.start = secondNearest;
				} else if (edge.end == target) {
					edge.end = secondNearest;
				} else {
					console.error("Got edge not connected to target node: #" + edge.id );
				}

				// Remove bad edges
				if (edge.start == edge.end || edgeExists(edge.start, edge.end, edges2)) {
					weave.edges.forEach(function (e, i, arr) {
						if (e == edge) {
							arr.splice(i, 1);
						}
						return;
					})	
				}
			});
			weave.nodes.forEach(function (n, i, arr) {
				if (n == target) {
					arr.splice(i, 1);
				}
			});
		}
		dragging = false;
		recalculate(canvas);
	}
	// set up a handler object that will initially listen for mousedowns then
	// for moves and mouseups while dragging
	var handler = {
		clicked:function(e){

			var pos = $(canvas).offset();
			var relativeToCanvas =  {x: e.pageX-pos.left, y: e.pageY-pos.top};
			var _mouseP = {x: relativeToCanvas.x-weave.offsetX, y: relativeToCanvas.y-weave.offsetY};
			console.log("Click -" + _mouseP.x + " " + _mouseP.y);
			if (panMode && !dragging) {
				panning = true;
				previousMouseP = relativeToCanvas;
			} else if (weave.mode == "erase") {
				if (target) {
					var edges = getNodeEdges(target);
					edges.forEach(function (edge) {
						weave.edges.forEach(function (e, i, arr) {
							if (e == edge) {
								arr.splice(i, 1);
							}
						})
					});
					weave.nodes = weave.nodes.filter(function (n, i, arr) {
						return !(n == target || getNodeEdges(n).length === 0)
					});
					recalculate(canvas);
				}
			} else if (weave.mode == "create") {
				if (dragging) {
					endDrag(_mouseP);
				} else {
					weave.highlightNode = null;
					// Create edge and two nodes at location
					if (target) {
						startNode = target;
					} else {
						startNode = createNode(_mouseP.x, _mouseP.y);
					}
					var end = createNode(_mouseP.x, _mouseP.y);
					createEdge(startNode, end);
					target = end;
					dragging = true;
					recalculate(canvas);
				}
			} else if (weave.mode == "edit") {
				if (dragging) {
					endDrag(_mouseP);
				} else {
					if (target) {
						weave.highlightNode = null;
						dragging = true;
					}
				}
			}
			return false
		},
		moved: function (e) {
			var pos = $(canvas).offset();
			var relativeToCanvas =  {x: e.pageX-pos.left, y: e.pageY-pos.top};
			var _mouseP = {x: relativeToCanvas.x-weave.offsetX, y: relativeToCanvas.y-weave.offsetY};
			if (dragging) {
				target.x = _mouseP.x;
				target.y = _mouseP.y;
				weave.highlightNode = Utilities.getNearestNode(weave.nodes, _mouseP.x, _mouseP.y, highlightRadius, [target, startNode]);
			} else if (panning) {
				weave.offsetX += relativeToCanvas.x - previousMouseP.x;
				weave.offsetY += relativeToCanvas.y - previousMouseP.y;
				previousMouseP = relativeToCanvas;
			} else {
				target = Utilities.getNearestNode(weave.nodes, _mouseP.x, _mouseP.y, highlightRadius);
				Utilities.nearbyEdges(weave.edges, _mouseP.x, _mouseP.y)
				weave.highlightNode = target;
			}
			draw(canvas)
			var ctx = canvas.getContext("2d")
			var w = 10;
			ctx.fillStyle = "purple";

	        ctx.beginPath();
			ctx.arc(relativeToCanvas.x,relativeToCanvas.y,5,0,Math.PI*2,true);

			ctx.fill();
		},
		onKeyDown: function onKeyDown(e) {
			if(e.keyCode == 32) {
				panMode = true;
			}
		},
		
		onKeyUp: function onKeyUp(e) {
			if(e.keyCode == 32) {
				panMode = false;
			}
		},
		
		mouseup: function mouseup(e) {
			panning = false;
		}
	}

	// start listening
	$(canvas).mousemove(handler.moved);
	$(canvas).mousedown(handler.clicked);
	$(canvas).mouseup(handler.mouseup);
	$(document).keydown(handler.onKeyDown)
	$(document).keyup(handler.onKeyUp)
	$(".btnMode").click(function (e) {
		weave.mode = $(e.target).data('mode');
		$(".controls .active").toggleClass("active")
		$(e.target).toggleClass("active")
	})
}

$(document).ready(function() {
	var n1 = createNode(500, 100);
	var n2 = createNode(300, 300);
	var n3 = createNode(500, 300);
	var n4 = createNode(700, 300);
	var n5 = createNode(300, 500);
	var n6 = createNode(500, 500);
	var n7 = createNode(700, 500);
	var n8 = createNode(500, 700);

	createEdge(n1, n3);
	createEdge(n2, n3);
	createEdge(n3, n4);
	createEdge(n3, n6);
	createEdge(n2, n5);
	createEdge(n4, n7);
	createEdge(n5, n6);
	createEdge(n6, n7);
	createEdge(n6, n8);

	// Triangle
	var t1 = createNode(600, 50);
	var t2 = createNode(1000, 50);
	var t3 = createNode(800, 340);
	createEdge(t1, t2);
	createEdge(t1, t3);
	createEdge(t2, t3);
	var canvas = $("#node-canvas").get(0);
	initMouseHandling(canvas);
	recalculate(canvas);
});
