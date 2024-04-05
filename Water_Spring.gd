extends Node2D

var velocity = 0
var force = 0
var height = 0
var target_height = 0

@onready var collision = $Area2D/CollisionShape2D

var index = 0

var motion_factor = 0.2

signal splash

func water_update(spring_constant, dampening):
	height = position.y
	var x = height - target_height
	var loss = -dampening * velocity
	
	#hooke's law:
	force = - spring_constant * x + loss
	
	velocity += force
	position.y += velocity
	pass
	
func initialize(x_postion, id):
	height = position.y
	target_height = position.y
	velocity = 0
	position.x = x_postion
	index = id
	
func set_collision_width(value):
	var cur_size = collision.shape.get_size()
	var new_size = Vector2(value/2,cur_size.y)
	collision.shape.set_size(new_size)

func _on_area_2d_body_entered(body):
	var speed = body.global_position.y * motion_factor
	emit_signal("splash", index, speed)
