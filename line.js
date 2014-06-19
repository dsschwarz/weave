// start and end contain x and y coords
Line = function(start, end) {
	if (start.x === undefined ||
		start.y === undefined ||
		end.x === undefined ||
		end.y === undefined)
	{
		console.warn("Invalid line", start, end);
		return {};
	}

	function toVector() {
		return {
			x: end.x - start.x,
			y: end.y - start.y
		}
	}

	function dot(vector) {
		var thisVector = toVector();

		return vector.x * thisVector.x + vector.y * thisVector.y;
	}

	function projectOnto(vector) {
		var dotProduct = dot(vector); 
		var thisVector = toVector();

		Utilities.normalize(vector);

		return {
			x: dotProduct * vector.x,
			y: dotProduct * vector.y
		}

	}

	function normalize() {
		return Utilities.normalize(toVector());
	}

	function magnitude() {
		return Utilities.magnitude(toVector());
	}

	// TODO - add in crossproduct check to check if intersects on edgeA line segment, not just along infinite line
	function checkIntersect (edgeA, edgeB) {
		// Center at edgeA start
		// Check if edgeB endpoints edge on opposite sides of edgeA
		var aX = edgeA.end.x - edgeA.start.x;
		var aY = edgeA.end.y - edgeA.start.y;

		var crossStart = aX * (edgeB.start.y - edgeA.start.y) - aY * (edgeB.start.x - edgeA.start.x);
		var crossEnd = aX * (edgeB.end.y - edgeA.start.y) - aY * (edgeB.end.x - edgeA.start.x);

		return (crossStart * crossEnd < 0); // true if opposite signs (opposite sides of edgeA)
	}

	return {
		magnitude: magnitude,
		normalize: normalize,
		toVector: toVector,
		dot: dot,
		projectOnto: projectOnto
	}

	
}

// a and b are vectors from basepoint of ref edge to a point
// returns true if a is closer than b tracing ccw from refEdge
function closerCCW(a, b, referenceEdge, basepoint) {
	Utilities.normalize(a);
	Utilities.normalize(b);
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

Utilities = {
	// In place normalize
	normalize: function normalize (vector) {
		var mag = Utilities.magnitude(vector);
		vector.x /= mag;
		vector.y /= mag;
		return vector;
	},

	magnitude: function magnitude (vector) {
		return Math.sqrt(vector.x*vector.x + vector.y*vector.y);
	},

	nearbyEdges: function nearbyEdges(givenEdges, x, y) {
		var edges = [];
		givenEdges.forEach(function(edge) {
			var start = edge.start;
			var end = edge.end;

			var xDif = (end.x - start.x);
			var yDif = (end.y - start.y);

			var midX = start.x + xDif/2;
			var midY = start.y + yDif/2;

			var sqDist = xDif * xDif + yDif * yDif;
			var dist = Math.sqrt(dist)
			var sqA = sqDist / 4; // divide by 2 squared
			var sqB = 10; // arbitrary

			var offset = { x: x - midX,
						   y: y - midY}

			var n = offset.x * xDif / dist
			var t = offset.y * yDif / dist

			if (n * sqB + t * sqA < sqB * sqA) {
				edges.push(edge)
				console.log("Found edge")
			}

		})
	},

	getNearestNode: function getNearestNode (nodes, x, y, radius, ignore) {
		var nearest = null;
		nodes.forEach(function(n) {
			var dist = (n.x-x)*(n.x-x) + (n.y-y)*(n.y-y);

			if (radius && dist > radius * radius) {
				return;
			}
			if (n === ignore || ((ignore instanceof Array) && ($.inArray(n, ignore) !== -1))) {
				return;
			}

			if (!nearest) {
				nearest = n;
				return;
			}
			if((nearest.x - x)*(nearest.x - x) + (nearest.y - y)*(nearest.y - y) > dist) {
				nearest = n;
			}
		});
		return nearest;
	},
	


	getClosest: function getClosest(refEdge, basepoint, clockwise) {
		var baseNode = refEdge[basepoint];
		var oppBasepoint = (basepoint === "start") ? "end" : "start";

		var edges = getNodeEdges(baseNode);
		var closestEdge;
		var closestVector;
		var compareFunction = clockwise ? closerCW : closerCCW;

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

			if (!closestEdge || compareFunction(eVector, closestVector, refEdge, basepoint)) {
				closestVector = eVector;
				closestEdge = e;
			}
		};

		return closestEdge || refEdge; // Return itself if no other edge exists

	}
}