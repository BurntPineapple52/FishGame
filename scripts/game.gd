extends Node2D

@export var stages = [preload("res://scenes/stages/main_menu.tscn"),preload("res://scenes/stages/bear_stage.tscn")]
@onready var current_stage = $Main_Menu


var stage_id = 0

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass

func next_stage():
	print("next_stage")
	current_stage.queue_free()
	stage_id+=1
	current_stage = stages[stage_id].instantiate()
	add_child(current_stage)

func restart_stage():
	current_stage.queue_free()
	current_stage = stages[stage_id].instantiate()
	add_child(current_stage)
