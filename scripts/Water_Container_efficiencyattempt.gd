extends Node2D

var t = 1
var dt = 1

@export var k = 0.015
@export var d = 0.03
@export var spread = 0.0002

var springs = []
var passes = 1#4#8
var old_passes = 12

@export var distance_between_springs = 32
@export var spring_number = 6

@onready var water_spring = preload("res://scenes/units/water_spring.tscn")

@export var depth = 1000
var target_height = global_position.y
var bottom = target_height + depth

@onready var water_polygon = $Water_Polygon

@onready var water_border = $Water_Border
@export var border_thickness = 0.4

@onready var collisionShape = $Water_Area/CollisionShape2D
@onready var water_area = $Water_Area

@export var is_current = true
@export var water_speed = 6000
@export var water_direction = Vector2(-1,0)


# Called when the node enters the scene tree for the first time.
func _ready():
	spread = spread / 1000
	water_border.width = border_thickness
	
	for i in range(spring_number):
		var x_position = distance_between_springs * i
		var w = water_spring.instantiate()
		
		add_child(w)
		springs.append(w)
		w.initialize(x_position, i)
		w.set_collision_width(distance_between_springs)
		w.connect("splash", splash)
		
	var total_length = distance_between_springs * (spring_number - 1)
	var rectangle = RectangleShape2D.new().duplicate()
	var rectangle_position = Vector2(total_length/2,depth/2)
	var rectangle_size = Vector2(total_length,depth)
	#print(total_length)
	
	water_area.position = rectangle_position
	rectangle.set_size(rectangle_size)
	collisionShape.set_shape(rectangle)


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _physics_process(delta):
	
	#change to update only springs within range.
	#var camera = get_viewport().get_camera_2d()
	#var width = 1200
	#var boundl = clamp(camera.get_screen_center_position().x-width/2,get_global_position().x,get_global_position().x+distance_between_springs*spring_number)
	#var boundr = clamp(camera.get_screen_center_position().x-width/2,get_global_position().x,get_global_position().x+distance_between_springs*spring_number)
	##camera.get_screen_center_position().x+width/2
	#
	#var start_pin = floor((boundl - get_global_position().x)/distance_between_springs)
	#var end_pin = ceil((boundr - get_global_position().x)/distance_between_springs)
	#
	
	for i in springs: #range(start_pin,end_pin):
		i.water_update(k,d)
		#springs[start_pin+i].water_update(k,d)
	
	var left_deltas = []
	var right_deltas = []
	
		#might have to leave this one
	for i in range(springs.size()): #range(start_pin,end_pin):#
		left_deltas.append(0)
		right_deltas.append(0)
		
			
	#for j in range(passes):
		#for i in range(start_pin,end_pin):
			#springs[start_pin+i].position.y += 0.2 * sin(2 * i + t)
			#springs[start_pin+i].position.y += 0.3 * sin(1 * i + 2 * t)
			#springs[start_pin+i].position.y += 0.2 * sin(0.5 * i + 1.5 * t)
			#springs[start_pin+i].position.y += 0.1 * sin(2 * i + 0.5 * t)
			#if start_pin+i > start_pin:#0:
				#left_deltas[start_pin+i] = spread * (springs[start_pin+i].height - springs[start_pin+i-1].height)
				#springs[start_pin+i-1].velocity += left_deltas[start_pin+i]
			#if start_pin+i < end_pin-1:#springs.size()-1:
				#right_deltas[start_pin+i] = spread * (springs[start_pin+i].height - springs[start_pin+i+1].height)
				#springs[start_pin+i +1].velocity+= right_deltas[start_pin+i]
	for j in range(passes):
		for i in range(springs.size()):
			springs[i].position.y += 0.2 * old_passes * sin(2 * i + t)
			springs[i].position.y += 0.3 * old_passes * sin(1 * i + 2 * t)
			springs[i].position.y += 0.2 * old_passes * sin(0.5 * i + 1.5 * t)
			#springs[i].position.y += 0.1 * old_passes * sin(2 * i + 0.5 * t)
			if i > 0:
				left_deltas[i] = spread * (springs[i].height - springs[i-1].height)
				springs[i-1].velocity += left_deltas[i]
			if i < springs.size()-1:
				right_deltas[i] = spread * (springs[i].height - springs[i+1].height)
				springs[i +1].velocity+= right_deltas[i]
				
	draw_border()
	draw_water_body()
	t += dt * delta
	
func draw_water_body():
	var curve = water_border.curve
	
	var points = Array(curve.get_baked_points())

	var water_polygon_points = points
		
	var first_index = 0
	var last_index = water_polygon_points.size()-1

	water_polygon_points.append(Vector2(water_polygon_points[last_index].x, depth))
	water_polygon_points.append(Vector2(water_polygon_points[first_index].x, depth))

	water_polygon.polygon = PackedVector2Array(water_polygon_points)

func draw_border():
	var curve = Curve2D.new().duplicate()

	var surface_points = []

	for i in range(springs.size()):
		surface_points.append(springs[i].position)
		
	for i in range(surface_points.size()):
		curve.add_point(surface_points[i])
		
	water_border.curve = curve
	water_border.smooth(true)
	water_border.queue_redraw()	
	
func splash(index, speed):
	if index >= 0 and index < springs.size():
		springs[index].velocity += speed
