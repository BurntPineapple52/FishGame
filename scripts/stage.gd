extends Node2D

@export var stage_xbounds = Vector2(-200,7600)
@export var camera_xbounds = Vector2(0,7600)
@export var camera_ybounds = Vector2(-20,1300)
@onready var game = $".."

# Called when the node enters the scene tree for the first time.
func _ready():
	print("bear ready")
	pass # Replace with function body.

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass
	
func get_bounds():
	return stage_xbounds

func stage_complete():
	game.next_stage()

func restart_stage():
	game.restart_stage()
