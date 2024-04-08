extends Node2D

var t = 1
var dt = 1

var k = 0.015
var d = 0.03
var spread = 0.0002

var springs = []

func _ready():
	for i in get_children():
		springs.append(i)
		i.initialize()
		
	splash(2,5)
		
func _process(delta):
	
	for i in range(100):
		# make a sum of sin to generate some sort of wave
		var y:float = 0.5 * sin(i + t)
		y += 1 * sin(1 * i + 10 * t)
		
		# the position have to match the width of the polygon
		# here 100 * 10 = 1000, see first two vertices above
		springs.append(Vector2(i*10, y))
	t += dt * delta # make the waves move over time
		
#func _physics_process(delta):
	#for i in springs:
		#i.water_update(k,d)
		#
	#var left_deltas = []
	#var right_deltas = []
	#
	#for i in range(springs.size()):
		#left_deltas.append(0)
		#right_deltas.append(0)
		#
	#for i in range(springs.size()):
		#if i > 0:
			#left_deltas[i] = spread * (springs[i].height - springs[i-1].height)
			#springs[i-1].velocity += left_deltas[i]
		#if i < springs.size()-1:
			#right_deltas[i] = spread * (springs[i].height - springs[i+1].height)
			#springs[i +1].velocity+= right_deltas[i]
			
func splash(index, speed):
	if index >= 0 and index < springs.size():
		springs[index].velocity += speed
		
			

	


