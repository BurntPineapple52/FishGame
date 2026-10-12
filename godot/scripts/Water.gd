extends Area2D

var buoyancy = -2000
var a_damp = 50
var l_damp = 4
var land_a_damp = 25
var land_l_damp = 0
@export var is_current = true
@export var water_speed = 6000
@export var water_direction = Vector2(-1,0)
@onready var water_container = $".."

# Called when the node enters the scene tree for the first time.
func _ready():
	is_current = water_container.is_current
	water_direction = water_container.water_direction
	water_speed = water_container.water_speed
	
	pass # Replace with function body.

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass

func _on_body_entered(body:RigidBody2D):
	if body.is_in_group("physics"):
		var cf = Vector2(0,0)
		#body.add_constant_central_force(Vector2(0,buoyancy))
		if !body.is_in_group("buoyant"):
			cf += Vector2(0,buoyancy)
		body.set_angular_damp(a_damp)
		body.set_linear_damp(l_damp)
		
		if body.is_in_group("player"):
			#print("body enterede")
		#print("player entered")
			body.in_water = true
		if is_current:
			var spd_mult=1
			if body.is_in_group("litter"):
				print("litter")
				spd_mult = .20
			elif body.is_in_group("waterplant"):
				spd_mult = .07
			elif body.get_mass() > 30:
				spd_mult = body.get_mass()/2
			#print("enable current")
			#body.add_constant_central_force(water_speed*water_direction)
			cf += water_speed*spd_mult*water_direction
		body.add_constant_central_force(cf)

func _on_body_exited(body:RigidBody2D):
	if body.is_in_group("physics"):
		var cf = Vector2(0,0)
		#body.add_constant_central_force(Vector2(0,-buoyancy))
		if !body.is_in_group("buoyant"):
			cf+=Vector2(0,-buoyancy)
		#body.set_constant_force(Vector2(0,0))	#shouldn't need this? also, there's a small chance that i can
		body.set_angular_damp(land_a_damp)
		body.set_linear_damp(land_l_damp)
		if body.is_in_group("player"):
			#print("player exit")
			body.in_water = false
		if is_current:
			var spd_mult=1
			if body.is_in_group("litter"):
				spd_mult = .20
			elif body.is_in_group("waterplant"):
				spd_mult = .07
			elif body.get_mass() > 30:
				spd_mult = body.get_mass()/2
			#print("negate current")
			#body.add_constant_central_force(-water_speed*water_direction)
			cf+=-water_speed*spd_mult*water_direction
		body.add_constant_central_force(cf)
