import React from "react";
import "./styles.css";
import { Canvas, useThree } from "react-three-fiber";
import { animated, useSpring } from "react-spring/three";
import { useGesture } from "react-use-gesture";
import * as THREE from "three";

function Plane({ position, onPlaneClick }) {
  return (
    <mesh position={position} onClick={onPlaneClick}>
      <planeBufferGeometry attach="geometry" args={[10000, 10000]} />
      <meshPhongMaterial attach="material" color="#48BF6C" />
    </mesh>
  );
}

const loader = new THREE.TextureLoader();

//document.addEventListener(
//  "touchmove",
//  ev => {
//    console.log("PO");
//    ev.preventDefault();
//  },
//  { passive: true }
//);
//
//document.addEventListener("gesturestart", e => e.preventDefault(), false);
//document.addEventListener("gesturechange", e => e.preventDefault(), false);

function Texture({ texture }) {
  return (
    <animated.mesh>
      <planeBufferGeometry attach="geometry" args={[5, 7]} />
      <meshStandardMaterial attach="material" map={texture} />
    </animated.mesh>
  );
}

function Image({ url }) {
  const { invalidate } = useThree();
  const texture = React.useMemo(() => {
    return loader.load(url, invalidate);
  }, [url, invalidate]);

  return <Texture texture={texture} />;
}

const calculateScreenPosition = ({
  imageDimensions: { width, height },
  scale,
  translateX,
  translateY,
  aspect
}) => {
  const imageWidth = width * scale * aspect;
  const imageHeight = height * scale * aspect;
  const imageTopLeftX =
    translateX * aspect + window.innerWidth / 2 - imageWidth / 2;
  const imageTopLeftY =
    window.innerHeight / 2 - translateY * aspect - imageHeight / 2;
  return { imageWidth, imageHeight, imageTopLeftY, imageTopLeftX };
};

const getTranslateOffsetsFromScale = ({
  imageTopLeftY,
  imageTopLeftX,
  imageWidth,
  imageHeight,
  scale,
  pinchDelta,
  touchOrigin: [touchOriginX, touchOriginY],
  currentTranslate: [translateX, translateY],
  aspect
}) => {
  //console.log(touchOriginX, touchOriginY);
  // Get the (x,y) touch position relative to image origin at the current scale
  const imageCoordX = (touchOriginX - imageTopLeftX - imageWidth / 2) / scale;
  const imageCoordY = (touchOriginY - imageTopLeftY - imageHeight / 2) / scale;
  // console.log(imageCoordX, imageCoordY);
  // Calculate translateX/Y offset at the next scale to zoom to touch position
  const newTranslateX =
    (-imageCoordX * pinchDelta + translateX * aspect) / aspect;
  const newTranslateY =
    (imageCoordY * pinchDelta + translateY * aspect) / aspect;

  return [newTranslateX, newTranslateY];
};

// without this the pinch-zoom on desktop (chrome osx) is interfered by wheel events
document.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
  },
  { passive: false }
);

export default function App() {
  const aspectRef = React.useRef(null);
  const [spring, set] = useSpring(() => ({
    scale: [1, 1, 1],
    position: [0, 0, 0],
    immediate: true
  }));
  const isPinchingRef = React.useRef(false);
  useGesture(
    {
      onPinch: ({
        movement: [xMovement],
        event,
        origin,
        ctrlKey,
        last,
        cancel
      }) => {
        isPinchingRef.current = true;

        const position = spring.position.get();
        const [scale] = spring.scale.get();
        // Prevent ImagePager from registering isDragging
        // setDisableDrag(true);

        let [touchOriginX, touchOriginY] = origin;

        // Don't calculate new translate offsets on final frame
        if (last) {
          cancel();
          return;
        }
        // Speed up pinch zoom when using mouse versus touch
        const SCALE_FACTOR = 100;
        const pinchScale = scale + xMovement / SCALE_FACTOR;
        const pinchDelta = pinchScale - scale;
        const { clientX, clientY } = event;

        const {
          imageWidth,
          imageHeight,
          imageTopLeftY,
          imageTopLeftX
        } = calculateScreenPosition({
          imageDimensions: { width: 5, height: 7 },
          scale,
          translateX: position[0],
          translateY: position[1],
          aspect: aspectRef.current
        });

        // Calculate the amount of x, y translate offset needed to
        // zoom-in to point as image scale grows
        const [newTranslateX, newTranslateY] = getTranslateOffsetsFromScale({
          imageTopLeftY,
          imageTopLeftX,
          imageWidth,
          imageHeight,
          scale,
          aspect: aspectRef.current,
          pinchDelta: pinchDelta,
          currentTranslate: [position[0], position[1]],
          // Use the [x, y] coords of mouse if a trackpad or ctrl + wheel event
          // Otherwise use touch origin
          touchOrigin: ctrlKey
            ? [clientX, clientY]
            : [touchOriginX, touchOriginY]
        });

        set({
          scale: [pinchScale, pinchScale, 1],
          position: [newTranslateX, newTranslateY, 0],
          pinching: true
        });
      },
      onTouchEnd: (event) => {
        //if (event.touches.length < 2) {
        //  isPinchingRef.current = false;
        //}
      },
      onDrag: ({
        movement: [xMovement, yMovement],
        first,
        memo = { initialTranslateX: 0, initialTranslateY: 0 },
        canceled
      }) => {
        //  if (isPinchingRef.current) return;
        const [translateX, translateY] = spring.position.get();
        if (first) {
          return {
            initialTranslateX: translateX,
            initialTranslateY: translateY
          };
        }
        set({
          position: [
            memo.initialTranslateX + xMovement / aspectRef.current,
            memo.initialTranslateY - yMovement / aspectRef.current,
            0
          ]
        });
        return memo;
      }
    },
    {
      eventOptions: { passive: false },
      initial: () => spring.position.get(),
      domTarget: window.document,
      window
    }
  );

  const [mousePos, setMousePos] = React.useState(() => [0, 0]);

  React.useEffect(() => {
    const listener = (ev) => {
      setMousePos([ev.clientX, ev.clientY]);
    };
    window.addEventListener("mousemove", listener);

    const onClick = (ev) => {
      const [translateX, translateY] = spring.position.get();
      const [scale] = spring.scale.get();

      const { imageTopLeftY, imageTopLeftX } = calculateScreenPosition({
        imageDimensions: { width: 5, height: 7 },
        scale,
        translateX,
        translateY,
        aspect: aspectRef.current
      });

      console.log(
        "Image position relative to viewport:",
        imageTopLeftY,
        imageTopLeftX
      );
    };
    window.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("mousemove", listener);
      window.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <>
      <Canvas
        onCreated={({ aspect, size, viewport }) => {
          aspectRef.current = viewport.factor;
        }}
        camera={{ position: [0, 0, 5] }}
      >
        <ambientLight intensity={1} />
        <Plane />
        <animated.group {...spring}>
          <Image url="https://images.unsplash.com/photo-1517462964-21fdcec3f25b?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=934&q=80" />
        </animated.group>
      </Canvas>
      <div
        style={{
          background: "red",
          position: "absolute",
          height: 50,
          width: 50,
          zIndex: 900,
          bottom: 0,
          right: 0
        }}
      >
        {mousePos[0]}| {mousePos[1]}
      </div>
    </>
  );
}
