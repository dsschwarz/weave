var weave = {
	nodes: [],
	edges: [],
	lineSegs: [], // Might be optional
	lines: []
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

// compare is either closerCW or closerCCW
function getClosest(refEdge, basepoint, compare) {
	var baseNode = refEdge[basepoint];
	var oppBasepoint = (basepoint === "start") ? "end" : "start";

	var edges = getNodeEdges(baseNode);
	var closestEdge;
	var closestVector;
	if(refEdge.id == 5) debugger;
	// Edges are either in series or converging/diverging (opposite)
	for (var i = 0; i < edges.length; i++) {
		var e = edges[i];
		if (e === refEdge) {
			continue;
		}
		var key = e[basepoint] == baseNode ? oppBasepoint : basepoint;
		// Create a vector from the basenode to the other end of the edge
		var eVector = {
			x: e[key].x - baseNode.x,
			y: e[key].y - baseNode.y
		};
		if (!closestEdge || compare(eVector, closestVector, refEdge, basepoint)) {
			closestVector = eVector;
			closestEdge = e;
		}
	};

	return closestEdge || refEdge; // Return itself if no other edge exists

}

// a and b are vectors from basepoint of ref edge to a point
// returns true if a is closer than b tracing ccw from refEdge
function closerCCW(a, b, referenceEdge, basepoint) {
	normalize(a);
	normalize(b);
	var e = {x: referenceEdge.end.x - referenceEdge.start.x, y: referenceEdge.end.y - referenceEdge.start.y}
	if (basepoint === "end") {
		e.x *= -1;
		e.y *= -1;
	}

	var dirA = (a.x * e.y - a.y * e.x > 0) ? "cw" : "ccw"; // Cross product gives direction rotated from refEdge
	var dirB = (b.x * e.y - b.y * e.x > 0) ? "cw" : "ccw"; // If result is positive, vector is cw of refEdge

	if (dirA !== dirB) {
		return dirA === "ccw";
	} else {
		var dotA = (a.x * e.x + a.y * e.y); 
		var dotB = (b.x * e.x + b.y * e.y); 
		if (dirA === "ccw") { // Farther ccw you go, more negative dot product becomes
			return dotA  > dotB;
		} else { // Increases after 180 degree mark
			return dotA < dotB
		}
	}

	console.warn("Why you still here - closerCCW")
}

function closerCW () {
	return !closerCCW.apply(this, arguments);
}
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
function checkIntersect (edgeA, edgeB) {
	// Center at edgeA start
	// Check if edgeB endpoints edge on opposite sides of edgeA
	var aX = edgeA.end.x - edgeA.start.x;
	var aY = edgeA.end.y - edgeA.start.y;

	var crossStart = aX * (edgeB.start.y - edgeA.start.y) - aY * (edgeB.start.x - edgeA.start.x);
	var crossEnd = aX * (edgeB.end.y - edgeA.start.y) - aY * (edgeB.end.x - edgeA.start.x);

	return (crossStart * crossEnd < 0); // true if opposite signs (opposite sides of edgeA)
}

// In place normalize
function normalize (vector) {
	var mag = magnitude(vector);
	vector.x /= mag;
	vector.y /= mag;
}

function magnitude (vector) {
	return Math.sqrt(vector.x*vector.x + vector.y*vector.y);
}

// Find all the connections between crossings
function recalculate (canvas) {
	for (var i = 0; i < weave.edges.length; i++) {
		var e = weave.edges[i];
		if (!e.q1.external) {
			makeConnection("q1", e, "end", closerCW);
		}
		if (!e.q2.external) {
			makeConnection("q2", e, "start", closerCCW);
		}
		if (!e.q3.external) {
			makeConnection("q3", e, "start", closerCW);
		}
		if (!e.q4.external) {
			makeConnection("q4", e, "end", closerCCW);
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

function makeConnection (q, edge, basepoint, compare) {
	var closestEdge = getClosest(edge, basepoint, compare);
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

	console.log("Making connection: " + q + " " + targetQuad + " from edge " + edge.id + " to " + closestEdge.id);
	
	if (closestEdge[targetQuad].external) {
		console.error("Already connected")
		debugger;
	}
	closestEdge[targetQuad].external = {edge: edge, quad: q};
	edge[q].external = {edge: closestEdge, quad: targetQuad};
}
function draw (canvas) {
	var ctx = canvas.getContext("2d");
	// Use bezier curve between quads
	// Draw each edge
	// Draw each node
	// Draw the weave
	ctx.fillStyle = "white"
	ctx.fillRect(0,0, canvas.width, canvas.height)

	for (var i = 0; i < weave.edges.length; i++) {
		var e = weave.edges[i];
		var pt1 = e.start;
		var pt2 = e.end;
		e.q1.drawn = e.q2.drawn = e.q3.drawn = e.q4.drawn = false;
		// pt1:  {x:#, y:#}  source position in screen coords
		// pt2:  {x:#, y:#}  target position in screen coords

		// draw a line from pt1 to pt2
		ctx.strokeStyle = "rgba(0,0,0, .333)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(pt1.x, pt1.y);
		ctx.lineTo(pt2.x, pt2.y);
		ctx.stroke();

		ctx.font="30px Verdana";
		ctx.fillStyle = "red";
		ctx.fillText("e" + e.id , (pt1.x + pt2.x)/2, (pt1.y + pt2.y)/2);

		var quads = ["q1", "q2", "q3", "q4"];
		quads.forEach(function(q) {
			var t = getCoord({edge: e, quad: q});
			// ctx.fillText(q,t.x, t.y);
		})
	}

	for (var i = 0; i < weave.nodes.length; i++) {
		var pt = weave.nodes[i];

		// draw a rectangle centered at pt
		var w = 10;
		ctx.fillStyle = "green";

        ctx.beginPath();
		ctx.arc(pt.x,pt.y,5,0,Math.PI*2,true);

          ctx.fill();
	};

	for (var i = 0; i < weave.edges.length; i++) {
		var e = weave.edges[i];
		var quads = ["q1", "q2", "q3", "q4"];
		quads.forEach(function(q) {
			if (!e[q].drawn) {
				drawWeave(ctx, e, q);
			}
		})
	};
}

function drawWeave (ctx, initEdge, quad) {
	var conn = "external";
	var oppConn = "internal";
	var currQ = quad; // String
	var currE = initEdge; // Object
	var count = 0;
	do {
		var cnctn = currE[currQ][conn]; // Edge and quad that the current edge and quadrant is connected to
		var oppConn = (conn === "external") ? "internal" : "external";
		if (count > 1000) {
			console.error("Weave loop too long");
			return;
		}
		var begin = getCoord({edge: currE, quad: currQ});
		var end = getCoord(currE[currQ][conn]);
		ctx.strokeStyle = "rgba(40,20,20, 1)";
		ctx.lineWidth=20;
		ctx.beginPath();
		ctx.moveTo(begin.x, begin.y);

		if (conn === "external") {
			

			var control1 = {x: begin.x * 2 - getCoord( currE[currQ][oppConn]).x,
							y: begin.y * 2 - getCoord( currE[currQ][oppConn]).y};

			var control2 = {x: end.x * 2 - getCoord( cnctn.edge[cnctn.quad][oppConn]).x,
							y: end.y * 2 - getCoord( cnctn.edge[cnctn.quad][oppConn]).y};

			ctx.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, end.x, end.y); // From quad to quad, handle points are opposite other quads on each end
		    ctx.stroke();

			ctx.strokeStyle = "white";
			ctx.lineWidth=14;
			ctx.beginPath();
			ctx.moveTo(begin.x, begin.y);
			ctx.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, end.x, end.y); // From quad to quad, handle points are opposite other quads on each end
		    ctx.stroke();

		} else {
			ctx.lineTo(end.x, end.y);
			ctx.stroke();

			ctx.strokeStyle = "white";
			ctx.lineWidth=14;
			ctx.beginPath();
			ctx.moveTo(begin.x, begin.y);
			ctx.lineTo(end.x, end.y);
			ctx.stroke();
		}
		currE[currQ].drawn = true;

		currQ = cnctn.quad;
		currE = cnctn.edge;
		conn = oppConn;
	} while (currE !== initEdge || currQ !== quad);
}

function getCoord (info) {
	var os = 30; // Quad distance from center of edge

	var e = info.edge; // Object (edge)
	var quad = info.quad; // String
	var vector = {x: e.end.x - e.start.x, y: e.end.y - e.start.y};
	var mag = magnitude(vector);
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

var _nextId = 0;
function getId () {
	return _nextId++;
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
	// draw(canvas);
	debugger;
	recalculate(canvas);
});


// NEEDS REFACTORING
// De-arborize this
function initMouseHandling() {
	// no-nonsense drag and drop (thanks springy.js)
	var dragged = null;

	// set up a handler object that will initially listen for mousedowns then
	// for moves and mouseups while dragging
	var handler = {
		clicked:function(e){
			var pos = $(canvas).offset();
			_mouseP = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)
			dragged = particleSystem.nearest(_mouseP);

			if (dragged && dragged.node !== null){
	// while we're dragging, don't let physics move the node
	dragged.node.fixed = true
	}

	$(canvas).bind('mousemove', handler.dragged)
	$(window).bind('mouseup', handler.dropped)

	return false
	},
	dragged:function(e){
		var pos = $(canvas).offset();
		var s = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)

		if (dragged && dragged.node !== null){
			var p = particleSystem.fromScreen(s)
			dragged.node.p = p
		}

		return false
	},

	dropped:function(e){
		if (dragged===null || dragged.node===undefined) return
			if (dragged.node !== null) dragged.node.fixed = false
				dragged.node.tempMass = 1000
			dragged = null
			$(canvas).unbind('mousemove', handler.dragged)
			$(window).unbind('mouseup', handler.dropped)
			_mouseP = null
			return false
		}
	}

	// start listening
	$(canvas).mousedown(handler.clicked);

}