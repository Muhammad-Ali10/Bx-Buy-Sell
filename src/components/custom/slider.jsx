import React, { useState } from 'react';
import { Range } from 'react-range';

const PriceSlider = () => {
  const STEP = 10;
  const MIN = 0;
  const MAX = 1000;
  const [values, setValues] = useState([200, 800]);

  return (
    <div className="flex flex-col items-center p-4">
      <p className="mb-2 text-white">
        Price Range: ${values[0]} - ${values[1]}
      </p>
      <Range
        step={STEP}
        min={MIN}
        max={MAX}
        values={values}
        onChange={setValues}
        renderTrack={({ props, children }) => (
          <div
            {...props}
            style={{
              ...props.style,
              height: '6px',
              width: '100%',
              backgroundColor: '#333',
              borderRadius: '4px',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                height: '6px',
                background: '#ADFF2F', // neon green
                borderRadius: '4px',
                left: `${(values[0] / MAX) * 100}%`,
                width: `${((values[1] - values[0]) / MAX) * 100}%`,
              }}
            />
            {children}
          </div>
        )}
        renderThumb={({ props }) => (
          <div
            {...props}
            style={{
              ...props.style,
              height: '20px',
              width: '20px',
              borderRadius: '50%',
              backgroundColor: '#ADFF2F',
              border: '2px solid black',
              boxShadow: '0 0 4px #ADFF2F',
            }}
          />
        )}
      />
    </div>
  );
};

export default PriceSlider;
