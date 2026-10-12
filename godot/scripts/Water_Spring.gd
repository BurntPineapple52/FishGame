extends Node2D

var velocity = 0
var force = 0

var height = 0
var target_height = 0

@onready var collision = $Area2D/CollisionShape2D

var index = 0

var motion_factor = 0.2

var collided_with = null

signal splash

#This applies hooke's law
func water_update(spring_constant, dampening):
	height = position.y
	#current extension
	var x = height - target_height
	
	var loss = -dampening * velocity
	
	#hooke's law:
	force = - spring_constant * x + loss
	
	#apply force to velocity
 	#velocity = velocity + force
	velocity += force
	
 	#make's the spring move
	position.y += velocity
	
	
func initialize(x_position, id):
	height = position.y
	target_height = position.y
	velocity = 0
	position.x = x_position
	index = id
	
func set_collision_width(value):
	var cur_size = collision.shape.get_size()
	var new_size = Vector2(value/2,cur_size.y)
	collision.shape.set_size(new_size)

func _on_area_2d_body_entered(body):
	if body == collided_with: # or (body.is_in_group("player") and body.in_water):
		return
	collided_with = body
	#print(clamp(clamp(body.linear_velocity.y,0,1000)/30,10,80))
	var speed = clamp(clamp(body.linear_velocity.y,0,1000)/30,10,80)*motion_factor #body.global_position.y * motion_factor
	emit_signal("splash", index, speed)
