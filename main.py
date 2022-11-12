import pygame
import pygame.display
import pygame.time
import pygame.mouse

import field
import draw

FPS = 120


field_width = 9
field_height = 9
mine_count = 10

game_over = False
mouse_left_down: bool = False


def start_new_game():
    field.start_game(field_width, field_height, mine_count)
    draw.set_screen(field_width, field_height)


def get_mouse_pos():
    mx, my = pygame.mouse.get_pos()
    x = (mx - 4) // 16
    y = (my - 40) // 16
    return x, y


def process_input():
    global mouse_left_down

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            return True
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                return True
            if event.key == pygame.K_F2:
                start_new_game()

        if event.type == pygame.MOUSEBUTTONDOWN:
            x, y = get_mouse_pos()
            if 0 <= x < field.get_field_width() and 0 <= y < field.get_field_height():
                if event.button == 3:
                    field.flag_cell(x, y)
                if event.button == 1:  # preview
                    mouse_left_down = True
            else:
                mx, my = pygame.mouse.get_pos()
                if draw.is_face(mx, my):
                    start_new_game()

        if event.type == pygame.MOUSEBUTTONUP:
            if event.button == 1:
                mouse_left_down = False
                field.clear_preview()
                x, y = get_mouse_pos()
                if 0 <= x < field.get_field_width() and 0 <= y < field.get_field_height():
                    field.cell_up(x, y)

    if mouse_left_down:
        x, y = get_mouse_pos()
        if 0 <= x < field.get_field_width() and 0 <= y < field.get_field_height():
            field.set_preview(x, y)

    return False


def main():
    pygame.init()
    pygame.display.set_caption("Minesweeper in Python!")
    draw.load_assets()
    clock = pygame.time.Clock()

    start_new_game()

    while True:
        if process_input():
            break

        draw.draw_screen()
        pygame.display.flip()
        clock.tick(FPS)
    pygame.quit()


if __name__ == '__main__':
    print('Welcome!')
    main()
    print('Done!')
