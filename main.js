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
			case "parallel":
				e.q1.internal = e.q4;
				e.q4.internal = e.q1;
				e.q2.internal = e.q3;
				e.q3.internal = e.q2;
			case "wall":
				e.q1.internal = e.q2;
				e.q2.internal = e.q1;
				e.q3.internal = e.q4;
				e.q4.internal = e.q3;
			case default:
				console.error("Invalid type for edge " + edge);

		}
	};
}

function makeConnection (q, edge, basepoint, compare) {
	var closestEdge = getClosest(edge, basepoint, compare);
	var targetQuad;
	var inSeries = !(closestEdge[basepoint] === edge[basepoint]);

	switch (q) {
		case "q1":
			targetQuad = inSeries ? "q2" : "q4";
		case "q2":
			targetQuad = inSeries ? "q1" : "q3";
		case "q3":
			targetQuad = inSeries ? "q4" : "q2";
		case "q4":
			targetQuad = inSeries ? "q3" : "q2";
		case default:
			console.warn("param 'q' should be in q1 thru q4");
	}
	
	closestEdge[targetQuad].external = edge[q];
	edge[q].external = closestEdge[targetQuad];
}

var _nextId = 0;
function getId () {
	return _nextId++;
}