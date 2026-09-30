import { Player, type IPlayerProps } from '@lottiefiles/react-lottie-player'

// thin wrapper around @lottiefiles/react-lottie-player
// defaults to loop + autoplay, marks the element as decorative for a11y
type LottiePlayerProps = Omit<IPlayerProps, 'ref'>

export function LottiePlayer(props: LottiePlayerProps) {
  return <Player loop autoplay aria-hidden="true" {...props} />
}
