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
	type = type || "normal";
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
		q2, quad(),
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
		var key = e[basepoint] == baseNode ? oppBasepoint : baseNode;
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
	var e = {x: referenceEdge.end.x - referenceEdge.start.x, y: referenceEdge.end.y - referenceEdge.start.y)}
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
			edges.push(node);
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
function recalculate () {
	for (var i = 0; i < weave.edges.length; i++) {
		var e = weave.edges[i];
		if (!e.q1.external) {
			makeConnection(e.q1, e, "end", closerCW);
		}
		if (!e.q2.external) {
			makeConnection(e.q2, e, "start", closerCCW);
		}
		if (!e.q3.external) {
			makeConnection(e.q3, e, "start", closerCW);
		}
		if (!e.q4.external) {
			makeConnection(e.q4, e, "end", closerCCW);
		}
	};
}

function makeConnection (argument) {
	// body...
}

var _nextId = 0;
function getId () {
	return _nextId++;
}