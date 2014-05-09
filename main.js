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
	newEdge.q1.edge = newEdge.q2.edge = newEdge.q3.edge = newEdge.q4.edge = newEdge; // Care of cyclic structure here
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
	var oppBasepoint = basepoint = "start" ? "end" : "start";

	var edges = getNodeEdges(baseNode);
	var closestEdge;
	var closestVector;
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
			closestEdge = refEdge;
		}
	};

	return closestEdge || refEdge; // Return itself if no other edge exists

}

// a and b are vectors from basepoint of ref edge to a point
function closerCCW(a, b, referenceEdge, basepoint) {
	normalize(a);
	normalize(b);
	var e = {x: referenceEdge.end.x - referenceEdge.start.x, y: referenceEdge.end.y - referenceEdge.start.y}
	if (basepoint = "end") {
		e.x *= -1;
		e.y *= -1;
	}

	var dirA = (a.x * e.x - a.y * e.x) ? "left" : "right";
	var dirB = (b.x * e.x - b.y * e.x) ? "left" : "right";

	if (dirA !== dirB) {
		return dirA === "left";
	} else {
		var dotA = (a.x * e.x + a.y * e.y);
		var dotB = (b.x * e.x + b.y * e.y);
		if (dirA === "left") {
			return dotA  > dotB;
		} else {
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
				e.q1.internal = e.q3;
				e.q3.internal = e.q1;
				e.q2.internal = e.q4;
				e.q4.internal = e.q2;
				break;
			case "parallel":
				e.q1.internal = e.q4;
				e.q4.internal = e.q1;
				e.q2.internal = e.q3;
				e.q3.internal = e.q2;
				break;
			case "wall":
				e.q1.internal = e.q2;
				e.q2.internal = e.q1;
				e.q3.internal = e.q4;
				e.q4.internal = e.q3;
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
			targetQuad = inSeries ? "q3" : "q2";
			break;
		default:
			console.warn("param 'q' should be in q1 thru q4");
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
	var currentQ = initEdge[quad];
	var count = 0;
	do {
		var oppConn = (conn === "external") ? "internal" : "external";
		if (count > 1000) {
			console.error("Weave loop too long");
			return;
		}
		var begin = getCoord({edge: initEdge, quad: quad});
		var control1 = {x: begin.x * 2 - getCoord(quad[oppConn]).x,
						y: begin.y * 2 - getCoord(quad[oppConn]).y};
		var end = getCoord(quad[conn]);
		var control2 = {x: end.x * 2 - getCoord(quad[conn][oppConn]).x,
						y: end.y * 2 - getCoord(quad[conn][oppConn]).y};

		ctx.strokeStyle = "rgba(40,20,20, .7)";
		ctx.moveTo(begin.x, begin.y);
		ctx.drawBezierCurve(control1.x, control1.y, control2.x, control2.y, end.x, end.y); // From quad to quad, handle points are opposite other quads on each end
		currentQ.drawn = true;
		currentQ = currentQ[conn];
		conn = oppConn;
	} while (currentQ !== quad);
}

function getCoord (info) {

	var e = info.edge; // Object (edge)
	var quad = info.quad; // String

}

var _nextId = 0;
function getId () {
	return _nextId++;
}

$(document).ready(function() {
	var n1 = createNode(10, 10);
	var n2 = createNode(40, 40);
	var e = createEdge(n1, n2);

	var canvas = $("#node-canvas").get(0);
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