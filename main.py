import pygame
import pygame.display
import pygame.time

import field
import draw

FPS = 120


field_width = 9
field_height = 9
mine_count = 10

game_over = False


def start_new_game():
    field.start_game(field_width, field_height, mine_count)

    draw.set_screen(field_width, field_height)


def process_input():
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            return True
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                return True

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
