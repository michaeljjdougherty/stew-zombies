The Cheddars' line: "Wanna play 2K?"

Put your recording in this folder, named exactly:

    wanna-play-2k.mp3

The game picks it up on the next load (if the file isn't here, the hounds use
the built-in growl-voice). Mono or stereo, any length; keep about a second of
nothing at either end trimmed off so it lands right when the bubble pops up.

To change the words in the speech bubble, or the volume / pitch of your
recording, edit the `cheddar` section of src/config.js:
    line             the text in the bubble
    lineAudioGain    louder / quieter (1.0 = as recorded)
    lineAudioPitch   0.85 = deeper and growlier, 1.0 = as recorded
    lineAudioGrowl   true = a bit of hound rattle under your voice
