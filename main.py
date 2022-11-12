import pygame
import pygame.display
import pygame.time


FPS = 120


field_width = 9
field_height = 9
mine_count = 10

game_over = False


def start_new_game():
    scr_w, scr_h = field_width * 8 + 4 * 2, field_height * 8 + 4 * 2 + 16
    screen = pygame.display.set_mode((scr_w, scr_h), pygame.SCALED | pygame.RESIZABLE)


def draw_screen(screen):

    pass


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
    clock = pygame.time.Clock()

    screen = start_new_game()

    while True:
        if process_input():
            break

        draw_screen(screen)
        clock.tick(FPS)
    pass


if __name__ == '__main__':
    print('Welcome!')
    main()
    print('Done!')
